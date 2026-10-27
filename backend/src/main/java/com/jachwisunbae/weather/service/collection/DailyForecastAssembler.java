package com.jachwisunbae.weather.service.collection;

import com.jachwisunbae.weather.domain.DailyForecast;
import com.jachwisunbae.weather.domain.DailyTemperature;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.WeatherElement;
import com.jachwisunbae.weather.provider.kma.GridForecast;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

public class DailyForecastAssembler {
    public List<DailyForecast> assemble(final LocalDate date, final Set<GridPoint> points,
                                        final List<GridForecast> forecasts, final LocalDateTime collectedAt) {
        if (forecasts.isEmpty()) {
            return List.of();
        }
        GridForecast minimum = forecasts.stream().filter(f -> f.element() == WeatherElement.TMN).findFirst().orElse(null);
        GridForecast maximum = forecasts.stream().filter(f -> f.element() == WeatherElement.TMX).findFirst().orElse(null);
        return points.stream().map(point -> new DailyForecast(point, date,
                temperature(minimum, point, collectedAt), temperature(maximum, point, collectedAt))).toList();
    }

    private DailyTemperature temperature(final GridForecast forecast, final GridPoint point, final LocalDateTime collectedAt) {
        // 요청 자체가 없으면 미제공, 응답 배열의 null이면 정상 결측이다.
        return forecast == null ? null : new DailyTemperature(forecast.values()[point.toIndex()],
                forecast.times().publishedAt(), collectedAt);
    }
}
