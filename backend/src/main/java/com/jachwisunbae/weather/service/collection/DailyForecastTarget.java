package com.jachwisunbae.weather.service.collection;

import com.jachwisunbae.weather.domain.WeatherElement;
import java.time.LocalDate;

// 발표분에서 미제공인 요소도 표현할 수 있도록 요청 시각 대신 대상 날짜를 보관한다.
public record DailyForecastTarget(LocalDate forecastDate, WeatherElement element) {

    public DailyForecastTarget {
        if (forecastDate == null || (element != WeatherElement.TMN && element != WeatherElement.TMX)) {
            throw new IllegalArgumentException("일별 예보 대상에는 날짜와 TMN 또는 TMX가 필요합니다.");
        }
    }
}
