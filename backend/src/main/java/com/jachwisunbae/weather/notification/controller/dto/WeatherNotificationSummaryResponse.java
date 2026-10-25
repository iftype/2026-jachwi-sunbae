package com.jachwisunbae.weather.notification.controller.dto;

import com.jachwisunbae.weather.notification.domain.WeatherNotification;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record WeatherNotificationSummaryResponse(UUID notificationId, LocalDate sendDate, String slot, LocalDate targetDate,
                                                  String title, Instant createdAt) {
    public static WeatherNotificationSummaryResponse from(final WeatherNotification n) {
        return new WeatherNotificationSummaryResponse(n.notificationId(), n.sendDate(), n.slot().name(), n.targetDate(),
                n.title(), n.createdAt());
    }
}
