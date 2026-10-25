package com.jachwisunbae.weather.notification.domain;

import com.jachwisunbae.weather.domain.GridPoint;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record PreparedWeatherNotification(UUID notificationId, long memberId, LocalDate sendDate, NotificationSlot slot,
                                           LocalDate targetDate, GridPoint grid, Instant locationObservedAt,
                                           Instant preparedAt, Instant expiresAt, String snapshot) {
    @Override
    public String toString() {
        return "PreparedWeatherNotification[notificationId=" + notificationId + "]";
    }
}
