package com.jachwisunbae.weather.notification.domain;

import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.notification.domain.LifeWeatherReport.Assessment;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record WeatherNotification(UUID notificationId, long memberId, LocalDate sendDate, NotificationSlot slot,
                                  LocalDate targetDate, GridPoint grid, String title, String body,
                                  List<Assessment> assessments, SendResult result, Instant createdAt) {
    public WeatherNotification {
        assessments = List.copyOf(assessments);
    }

    public enum SendResult { SUCCESS, FAILED }

    @Override
    public String toString() {
        return "WeatherNotification[notificationId=" + notificationId + "]";
    }
}
