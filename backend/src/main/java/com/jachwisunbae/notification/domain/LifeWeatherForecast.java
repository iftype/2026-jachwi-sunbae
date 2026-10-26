package com.jachwisunbae.notification.domain;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

// 조회 서비스에서 출처·신선도를 확인한 값만 전달한다. null은 사용할 수 없는 값이다.
public record LifeWeatherForecast(LocalDate date, NotificationSlot slot, List<Hour> hours,
                                  Double minimum, Double maximum, boolean sourceVerified) {
    public LifeWeatherForecast {
        hours = List.copyOf(hours);
    }

    public record Hour(LocalDateTime at, Double temperature, Double precipitationType, Double humidity) { }
}
