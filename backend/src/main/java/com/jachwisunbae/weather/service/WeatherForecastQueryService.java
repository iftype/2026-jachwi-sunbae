package com.jachwisunbae.weather.service;

import com.jachwisunbae.weather.domain.ForecastValueStatus;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.WeatherElement;
import com.jachwisunbae.weather.provider.kma.KmaGridConverter;
import com.jachwisunbae.weather.repository.WeatherForecastQueryRepository;
import com.jachwisunbae.weather.repository.WeatherForecastQueryRepository.StoredReading;
import com.jachwisunbae.weather.service.collection.WeatherPublicationSchedule;
import com.jachwisunbae.weather.service.dto.result.WeatherForecastResult;
import com.jachwisunbae.weather.service.dto.result.WeatherForecastResult.Coverage;
import com.jachwisunbae.weather.service.dto.result.WeatherForecastResult.Hour;
import com.jachwisunbae.weather.service.dto.result.WeatherForecastResult.Reading;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 한 격자의 하루치 예보(24시간 × 8요소 + 최저·최고기온)를 DB에서 읽어, 하루치 예보를 반환한다.
@Service
@Transactional(readOnly = true)
public class WeatherForecastQueryService {
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    // 저장된 값의 발표가 기대 발표보다 이 시간 넘게 오래되면 낡은 값으로 보고 내보내지 않는다.
    private static final int MAX_PUBLICATION_LAG_HOURS = 6;
    private final WeatherForecastQueryRepository repository;
    private final KmaGridConverter converter;
    private final Clock clock;

    public WeatherForecastQueryService(final WeatherForecastQueryRepository repository, final KmaGridConverter converter,
                                       final Clock clock) {
        this.repository = repository;
        this.converter = converter;
        this.clock = clock;
    }

    public WeatherForecastResult find(final double latitude, final double longitude, final LocalDate date) {
        return findByGrid(converter.convert(latitude, longitude), date);
    }

    // 정기 알림도 이 경계를 사용한다. 수집 HTTP 클라이언트를 호출하지 않는다.
    // 한 격자의 하루치 예보(24시간 × 8요소 + 최저·최고기온)를 DB에서 읽어, 하루치 예보를 반환한다.
    public WeatherForecastResult findByGrid(final GridPoint grid, final LocalDate requestedDate) {
        LocalDateTime now = LocalDateTime.ofInstant(clock.instant(), KST);
        LocalDate date = requestedDate == null ? now.toLocalDate() : requestedDate;
        // 예보 시각 → 요소 → 저장값 형태로 바꿔 시각·요소별로 바로 꺼낼 수 있게 한다.
        Map<LocalDateTime, Map<WeatherElement, StoredReading>> hourly = repository.findHourly(grid, date).stream()
                .collect(Collectors.groupingBy(StoredReading::forecastAt,
                        Collectors.toMap(StoredReading::element, Function.identity())));
        // 00~23시를 항상 24칸으로 채운다. 저장값이 없는 칸도 상태와 함께 내려간다.
        List<Hour> hours = IntStream.range(0, 24)
                .mapToObj(hour -> date.atTime(hour, 0))
                .map(target -> toHour(target, hourly.getOrDefault(target, Map.of()), now))
                .toList();


        // 그 날짜의 TMN·TMX 저장값을 요소 → 저장값 형태로 바꾼다. 저장값이 없으면 해당 키가 비어 있다.
        Map<WeatherElement, StoredReading> daily = repository.findDaily(grid, date).stream()
                .collect(Collectors.toMap(StoredReading::element, Function.identity()));
        // 당일 TMN은 02시 발표, TMX는 11시 발표가 마지막이다.
        Reading tmn = dailyReading(daily.get(WeatherElement.TMN), date.atTime(2, 0), now);
        Reading tmx = dailyReading(daily.get(WeatherElement.TMX), date.atTime(11, 0), now);
        // 전체 값(24시간 × 8요소 + TMN·TMX)이 모두 정상이면 AVAILABLE, 하나도 없으면 UNAVAILABLE, 그 사이면 PARTIAL
        List<Reading> all = new ArrayList<>(hours.stream().flatMap(hour -> hour.values().values().stream()).toList());
        all.add(tmn);
        all.add(tmx);
        long available = all.stream().filter(value -> value.status() == ForecastValueStatus.AVAILABLE).count();
        Coverage coverage = available == all.size() ? Coverage.AVAILABLE : available == 0 ? Coverage.UNAVAILABLE : Coverage.PARTIAL;
        return new WeatherForecastResult(grid, date, now, coverage, hours, tmn, tmx);
    }

    // 한 시각의 8개 요소마다 저장값의 상태를 판정한다.
    private Hour toHour(final LocalDateTime target, final Map<WeatherElement, StoredReading> stored,
                        final LocalDateTime now) {
        LocalDateTime expected = expectedPublication(target, now);
        Map<WeatherElement, Reading> values = new EnumMap<>(WeatherElement.class);
        for (WeatherElement element : WeatherElement.hourlyElements()) {
            values.put(element, reading(stored.get(element), expected, now));
        }
        return new Hour(target, values);
    }

    // 이 칸이 담고 있어야 할 발표: 지난 시각은 그 시각의 최신 발표, 앞으로 올 시각은 지금의 최신 발표
    private LocalDateTime expectedPublication(final LocalDateTime target, final LocalDateTime now) {
        return WeatherPublicationSchedule.latestAt(target.isBefore(now) ? target : now);
    }

    // 일별 기온의 기대 발표는 지금의 최신 발표와 그 날짜의 마지막 제공 발표 중 더 이른 쪽이다.
    private Reading dailyReading(final StoredReading stored, final LocalDateTime lastPublication, final LocalDateTime now) {
        LocalDateTime latest = WeatherPublicationSchedule.latestAt(now);
        LocalDateTime expected = latest.isAfter(lastPublication) ? lastPublication : latest;
        return reading(stored, expected, now);
    }

    // 저장값 하나의 상태를 판정한다.
    // - UNAVAILABLE: 저장값이 없음, 수집 완료 범위 밖(미완료·재수집 중), 또는 기대 발표보다 6시간 넘게 낡음
    // - MISSING: 정상 수집됐지만 기상청이 값을 주지 않음(결측)
    // - AVAILABLE: 그대로 사용할 수 있는 값
    private Reading reading(final StoredReading stored, final LocalDateTime expected,
                            final LocalDateTime now) {
        if (stored == null || stored.publishedAt() == null) {
            return new Reading(null, ForecastValueStatus.UNAVAILABLE, null, null);
        }
        ForecastValueStatus status;
        if (!stored.isVerified(now) || stored.publishedAt().isBefore(expected.minusHours(MAX_PUBLICATION_LAG_HOURS))) {
            status = ForecastValueStatus.UNAVAILABLE;
        } else if (stored.value() == null) {
            status = ForecastValueStatus.MISSING;
        } else {
            status = ForecastValueStatus.AVAILABLE;
        }
        // 확인되지 않은 값과 오래된 값은 수치로 소비되지 않도록 출처만 반환한다.
        return new Reading(status == ForecastValueStatus.AVAILABLE ? stored.value() : null,
                status, stored.publishedAt(), stored.collectedAt());
    }
}
