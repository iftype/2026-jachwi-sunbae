package com.jachwisunbae.weather.service.dto.result;

import com.jachwisunbae.weather.domain.ForecastValueStatus;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.WeatherElement;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record WeatherForecastResult(GridPoint grid, LocalDate date, LocalDateTime checkedAt,
                                    Coverage coverage, List<Hour> hourly, Reading tmn, Reading tmx) {
    public enum Coverage { AVAILABLE, PARTIAL, UNAVAILABLE }

    public WeatherForecastResult {
        hourly = List.copyOf(hourly);
    }

    public record Hour(LocalDateTime forecastAt, Map<WeatherElement, Reading> values) {
        public Hour {
            values = Map.copyOf(values);
        }
    }

    public record Reading(Double value, ForecastValueStatus status,
                          LocalDateTime publishedAt, LocalDateTime collectedAt) {
    }
}
