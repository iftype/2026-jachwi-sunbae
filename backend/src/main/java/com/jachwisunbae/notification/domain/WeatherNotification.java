package com.jachwisunbae.notification.domain;

import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.notification.domain.LifeWeatherReport.Notice;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record WeatherNotification(UUID notificationId, long memberId, LocalDate sendDate, NotificationSlot slot,
                                  LocalDate targetDate, GridPoint grid, String title, String body,
                                  List<Notice> notices, Instant createdAt) {
    public WeatherNotification {
        notices = List.copyOf(notices);
    }

    @Override
    public String toString() {
        return "WeatherNotification[notificationId=" + notificationId + "]";
    }
}
