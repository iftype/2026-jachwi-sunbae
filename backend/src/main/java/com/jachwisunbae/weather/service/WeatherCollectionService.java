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
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

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

    public void collect(final LocalDateTime publishedAt) {
        WeatherCollectionPlan plan = WeatherCollectionPlan.forPublication(publishedAt);
        int hourlyRows = 0;
        int dailyRows = 0;
        LOG.info("weather-collection-start publishedAt={}", publishedAt);
        try {
            // 재수집 시작 전에 완료 표시를 지워 부분 적재가 정상 예보로 노출되지 않게 한다.
            repository.startCollection(publishedAt);
            Map<ForecastTimes, List<KmaForecastRequest>> hours = plan.hourlyRequests().stream()
                    .collect(Collectors.groupingBy(KmaForecastRequest::times, LinkedHashMap::new, Collectors.toList()));
            // TMP 유효 격자는 시각마다 달라질 수 있어 날짜별 합집합을 유지한다.
            Map<LocalDate, Set<GridPoint>> dailyPoints = new LinkedHashMap<>();
            for (var entry : hours.entrySet()) {
                var rows = hourlyAssembler.assemble(entry.getKey(), fetch(entry.getValue()), now());
                repository.upsertHourly(rows);
                hourlyRows += rows.size();
                Set<GridPoint> points = dailyPoints.computeIfAbsent(entry.getKey().forecastAt().toLocalDate(),
                        ignored -> new HashSet<>());
                rows.forEach(row -> points.add(row.point()));
            }
            for (var entry : dailyPoints.entrySet()) {
                var requests = plan.dailyRequests().stream()
                        .filter(request -> request.times().forecastAt().toLocalDate().equals(entry.getKey())).toList();
                if (!requests.isEmpty()) {
                    var rows = dailyAssembler.assemble(entry.getKey(), entry.getValue(), fetch(requests), now());
                    repository.upsertDaily(rows);
                    dailyRows += rows.size();
                }
            }
            repository.completeCollection(publishedAt, now());
            LOG.info("weather-collection-end publishedAt={} success=true hourlyRows={} dailyRows={}",
                    publishedAt, hourlyRows, dailyRows);
        } catch (RuntimeException exception) {
            LOG.warn("weather-collection-end publishedAt={} success=false hourlyRows={} dailyRows={} exceptionType={}",
                    publishedAt, hourlyRows, dailyRows, exception.getClass().getSimpleName());
            throw exception;
        }
    }

    private List<GridForecast> fetch(final List<KmaForecastRequest> requests) {
        return requests.stream().map(client::fetch).toList();
    }

    private LocalDateTime now() {
        return LocalDateTime.ofInstant(clock.instant(), KST);
    }
}
