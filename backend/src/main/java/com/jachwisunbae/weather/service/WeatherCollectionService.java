package com.jachwisunbae.weather.service;

import com.jachwisunbae.weather.domain.ForecastTimes;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.provider.kma.GridForecast;
import com.jachwisunbae.weather.provider.kma.KmaForecastClient;
import com.jachwisunbae.weather.provider.kma.KmaForecastRequest;
import com.jachwisunbae.weather.repository.JdbcWeatherForecastRepository;
import com.jachwisunbae.weather.service.collection.DailyForecastAssembler;
import com.jachwisunbae.weather.service.collection.HourlyForecastAssembler;
import com.jachwisunbae.weather.service.collection.WeatherCollectionPlan;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

// 한 발표분의 전국 단기예보를 기상청에서 받아 시간별 및 일별 예보로 저장한다.
@Service
public class WeatherCollectionService {
    private static final Logger LOG = LoggerFactory.getLogger(WeatherCollectionService.class);
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private final KmaForecastClient client;
    private final JdbcWeatherForecastRepository repository;
    private final Clock clock;
    private final HourlyForecastAssembler hourlyAssembler = new HourlyForecastAssembler();
    private final DailyForecastAssembler dailyAssembler = new DailyForecastAssembler();

    public WeatherCollectionService(final KmaForecastClient client, final JdbcWeatherForecastRepository repository,
                                    final Clock clock) {
        this.client = client;
        this.repository = repository;
        this.clock = clock;
    }

    // 수집 상태를 시작→완료로 기록해, 완료되지 않은 수집 결과는 조회에 노출되지 않게 한다.
    public void collect(final LocalDateTime publishedAt) {
        // 기상청 API는 호출 1번에 (예보 시각 1개 × 요소 1개)의 전국 격자를 준다. 발표 하나당 호출 수는 다음과 같다.
        // - 시간별: 48시간 × 8개 요소(TMP·SKY·PTY·POP·PCP·SNO·REH·WSD) = 384번
        // - 일별: 날짜마다 TMN·TMX, 이미 제공이 끝난 당일 값을 빼면 4~6번
        WeatherCollectionPlan plan = WeatherCollectionPlan.forPublication(publishedAt);
        int hourlyRows = 0;
        int dailyRows = 0;
        LOG.info("weather-collection-start publishedAt={}", publishedAt);
        try {
            // 수집 시작을 기록하고 완료 시각을 비운다. 재수집 중에는 이전 값도 미검증으로 취급된다.
            repository.startCollection(publishedAt, now());
            // 예보 시각별로 요소 요청을 묶는다. 한 시각의 요소들을 모두 받아야 격자별 한 행을 만들 수 있다.
            Map<ForecastTimes, List<KmaForecastRequest>> hours = plan.hourlyRequests().stream()
                    .collect(Collectors.groupingBy(KmaForecastRequest::times, LinkedHashMap::new, Collectors.toList()));
            // 날짜별로 시간별 예보가 저장된 격자를 모아, 일별 기온도 같은 격자에만 저장한다.
            Map<LocalDate, Set<GridPoint>> dailyPoints = new LinkedHashMap<>();
            for (var entry : hours.entrySet()) {
                // 요소별 전국 응답을 격자별 시간 예보 행으로 결합한 뒤 바로 저장한다.
                var rows = hourlyAssembler.assemble(entry.getKey(), fetch(entry.getValue()), now());
                repository.upsertHourly(rows);
                hourlyRows += rows.size();
                Set<GridPoint> points = dailyPoints.computeIfAbsent(entry.getKey().forecastAt().toLocalDate(),
                        ignored -> new HashSet<>());
                rows.forEach(row -> points.add(row.point()));
            }
            // 날짜마다 TMN(06시)·TMX(15시)를 받아 해당 날짜의 격자에 연결한다.
            for (var entry : dailyPoints.entrySet()) {
                var requests = plan.dailyRequests().stream()
                        .filter(request -> request.times().forecastAt().toLocalDate().equals(entry.getKey())).toList();
                // 이미 지난 TMN·TMX는 계획에 없으므로 요청이 없는 날짜는 건너뛴다.
                if (!requests.isEmpty()) {
                    var rows = dailyAssembler.assemble(entry.getKey(), entry.getValue(), requests, fetch(requests), now());
                    repository.upsertDaily(rows);
                    dailyRows += rows.size();
                }
            }
            // 모든 저장이 끝난 뒤에만 완료를 기록한다. 조회는 시작~완료 사이에 수집된 행만 유효로 본다.
            repository.completeCollection(publishedAt, now());
            LOG.info("weather-collection-end publishedAt={} success=true hourlyRows={} dailyRows={}",
                    publishedAt, hourlyRows, dailyRows);
        } catch (RuntimeException exception) {
            LOG.warn("weather-collection-end publishedAt={} success=false hourlyRows={} dailyRows={} exceptionType={}",
                    publishedAt, hourlyRows, dailyRows, exception.getClass().getSimpleName());
            // 완료를 기록하지 않은 채 예외를 다시 던진다.
            throw exception;
        }
    }

    private List<GridForecast> fetch(final List<KmaForecastRequest> requests) {
        return requests.stream().map(client::fetch).toList();
    }

    // DB DATETIME(6) 정밀도에 맞춰 마이크로초까지만 남긴다.
    private LocalDateTime now() {
        return LocalDateTime.ofInstant(clock.instant(), KST).truncatedTo(ChronoUnit.MICROS);
    }
}
