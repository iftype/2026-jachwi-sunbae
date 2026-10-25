package com.jachwisunbae.weather.service;

import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
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
import java.time.Duration;
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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class WeatherForecastQueryService {
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final int MAX_PUBLICATION_LAG_HOURS = 6;
    private final WeatherForecastQueryRepository repository;
    private final KmaGridConverter converter;
    private final Clock clock;
    private final WeatherPublicationSchedule schedule;

    public WeatherForecastQueryService(final WeatherForecastQueryRepository repository, final KmaGridConverter converter,
                                       final Clock clock,
                                       @Value("${weather.collection.publication-delay-minutes:15}") final long delayMinutes) {
        this.repository = repository;
        this.converter = converter;
        this.clock = clock;
        this.schedule = new WeatherPublicationSchedule(Duration.ofMinutes(delayMinutes));
    }

    public WeatherForecastResult find(final double latitude, final double longitude, final LocalDate date) {
        return findByGrid(converter.convert(latitude, longitude), date);
    }

    // 정기 알림도 이 경계를 사용한다. 수집 HTTP 클라이언트를 호출하지 않는다.
    public WeatherForecastResult findByGrid(final GridPoint grid, final LocalDate requestedDate) {
        LocalDateTime now = LocalDateTime.ofInstant(clock.instant(), KST);
        LocalDate date = requestedDate == null ? now.toLocalDate() : requestedDate;
        if (date.isBefore(now.toLocalDate()) || date.isAfter(now.toLocalDate().plusDays(1))) {
            throw new InvalidInputException(ErrorCode.WEATHER_DATE_UNSUPPORTED, "KST 오늘·내일만 조회할 수 있습니다.");
        }
        Map<LocalDateTime, Map<WeatherElement, StoredReading>> hourly = repository.findHourly(grid, date).stream()
                .collect(Collectors.groupingBy(StoredReading::forecastAt,
                        Collectors.toMap(StoredReading::element, Function.identity())));
        List<Hour> hours = IntStream.range(0, 24).mapToObj(hour -> {
            LocalDateTime target = date.atTime(hour, 0);
            LocalDateTime expected = schedule.latestAt(target.isBefore(now) ? target : now);
            Map<WeatherElement, Reading> values = new EnumMap<>(WeatherElement.class);
            for (WeatherElement element : WeatherElement.hourlyElements()) {
                StoredReading stored = hourly.getOrDefault(target, Map.of()).get(element);
                values.put(element, reading(stored, expected, now, ForecastValueStatus.NOT_COLLECTED));
            }
            return new Hour(target, values);
        }).toList();
        Map<WeatherElement, StoredReading> daily = repository.findDaily(grid, date).stream()
                .collect(Collectors.toMap(StoredReading::element, Function.identity()));
        Reading tmn = dailyReading(daily.get(WeatherElement.TMN), date.atTime(2, 0), now);
        Reading tmx = dailyReading(daily.get(WeatherElement.TMX), date.atTime(11, 0), now);
        List<Reading> all = new ArrayList<>(hours.stream().flatMap(hour -> hour.values().values().stream()).toList());
        all.add(tmn);
        all.add(tmx);
        long available = all.stream().filter(value -> value.status() == ForecastValueStatus.AVAILABLE).count();
        Coverage coverage = available == all.size() ? Coverage.AVAILABLE : available == 0 ? Coverage.UNAVAILABLE : Coverage.PARTIAL;
        return new WeatherForecastResult(grid, date, now, coverage, hours, tmn, tmx);
    }

    private Reading dailyReading(final StoredReading stored, final LocalDateTime lastPublication, final LocalDateTime now) {
        LocalDateTime latest = schedule.latestAt(now);
        LocalDateTime expected = latest.isAfter(lastPublication) ? lastPublication : latest;
        ForecastValueStatus absent = latest.isAfter(lastPublication)
                ? ForecastValueStatus.NOT_PROVIDED : ForecastValueStatus.NOT_COLLECTED;
        return reading(stored, expected, now, absent);
    }

    private Reading reading(final StoredReading stored, final LocalDateTime expected,
                            final LocalDateTime now, final ForecastValueStatus absent) {
        if (stored == null || stored.publishedAt() == null) {
            return new Reading(null, absent, null, null);
        }
        ForecastValueStatus status;
        if (!stored.isVerified(now)) {
            status = ForecastValueStatus.UNVERIFIED;
        } else if (stored.publishedAt().isBefore(expected.minusHours(MAX_PUBLICATION_LAG_HOURS))) {
            status = ForecastValueStatus.STALE;
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
