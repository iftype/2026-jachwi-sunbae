package com.jachwisunbae.weather.service;

import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.provider.kma.KmaGridConverter;
import com.jachwisunbae.weather.repository.WeatherForecastQueryRepository;
import com.jachwisunbae.weather.service.dto.result.WeatherForecastResult;
import com.jachwisunbae.weather.service.dto.result.WeatherForecastResult.Hour;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class WeatherForecastQueryService {
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
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

    public WeatherForecastResult findByGrid(final GridPoint grid, final LocalDate requestedDate) {
        LocalDate date = requestedDate == null ? LocalDate.now(clock.withZone(KST)) : requestedDate;
        Map<LocalDateTime, Hour> stored = repository.findHourly(grid, date).stream()
                .collect(Collectors.toMap(Hour::forecastAt, Function.identity()));
        // 미수집 시각도 24칸의 nullable 숫자로 표현한다. 정상 0을 결측으로 바꾸지 않는다.
        var hours = IntStream.range(0, 24).mapToObj(hour -> date.atTime(hour, 0))
                .map(at -> stored.getOrDefault(at, Hour.missing(at))).toList();
        return new WeatherForecastResult(grid, date, hours, repository.findDaily(grid, date));
    }
}
