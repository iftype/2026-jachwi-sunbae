package com.jachwisunbae.weather.notification.domain;

import com.jachwisunbae.weather.domain.WeatherElement;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

// 조회 서비스에서 출처·신선도를 확인한 값만 전달한다. null은 판단에 사용할 수 없는 값이다.
public record LifeWeatherForecast(LocalDate date, NotificationSlot slot, List<Hour> hours,
                                  Double minimum, Double maximum, boolean sourceVerified) {
    public LifeWeatherForecast {
        hours = List.copyOf(hours);
    }

    public record Hour(LocalDateTime at, Map<WeatherElement, Double> values) {
        public Hour {
            Map<WeatherElement, Double> copy = new EnumMap<>(WeatherElement.class);
            copy.putAll(values);
            values = Collections.unmodifiableMap(copy);
        }

        public Double value(final WeatherElement element) {
            return values.get(element);
        }
    }
}
