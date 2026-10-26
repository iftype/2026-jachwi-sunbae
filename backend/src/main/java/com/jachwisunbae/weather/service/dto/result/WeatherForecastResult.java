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
    // 하루치 값(24시간 × 8요소 + TMN·TMX = 194개) 중 AVAILABLE인 값의 비율 요약
    public enum Coverage {
        AVAILABLE,   // 모든 값이 정상
        PARTIAL,     // 일부만 정상 (결측 MISSING 포함)
        UNAVAILABLE  // 정상 값이 하나도 없음 (예: 바다 격자, 수집 전, 오래 수집 실패)
    }

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
