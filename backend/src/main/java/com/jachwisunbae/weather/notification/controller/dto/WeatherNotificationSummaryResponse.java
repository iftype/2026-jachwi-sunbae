package com.jachwisunbae.weather.notification.controller.dto;

import com.jachwisunbae.weather.notification.service.WeatherNotificationHistoryService.Detail;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record WeatherNotificationSummaryResponse(UUID notificationId, LocalDate sendDate, String slot, LocalDate targetDate,
                                                  String title, Instant preparedAt) {
    public static WeatherNotificationSummaryResponse from(final Detail detail) {
        var n = detail.notification();
        return new WeatherNotificationSummaryResponse(n.notificationId(), n.sendDate(), n.slot().name(), n.targetDate(),
                detail.snapshot().report().title(), n.preparedAt());
    }
}
