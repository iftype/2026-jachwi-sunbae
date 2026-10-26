package com.jachwisunbae.notification.domain;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

// 조회 서비스의 완료 예보 중 생활 안내에 사용할 수 있는 값만 전달한다. null은 사용할 수 없는 값이다.
public record LifeWeatherForecast(LocalDate date, NotificationSlot slot, List<Hour> hours,
                                  Double minimum, Double maximum) {
    public LifeWeatherForecast {
        hours = List.copyOf(hours);
    }

    public record Hour(LocalDateTime at, Double temperature, Double precipitationType, Double humidity) { }
}
