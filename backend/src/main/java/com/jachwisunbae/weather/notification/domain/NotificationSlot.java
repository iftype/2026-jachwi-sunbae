package com.jachwisunbae.weather.notification.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.Optional;

public enum NotificationSlot {
    MORNING(7, 5), EVENING(22, 20);

    public static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private final int hour;
    private final int publicationHour;

    NotificationSlot(final int hour, final int publicationHour) {
        this.hour = hour;
        this.publicationHour = publicationHour;
    }

    public LocalDate targetDate(final LocalDate sendDate) {
        return this == MORNING ? sendDate : sendDate.plusDays(1);
    }

    public int firstForecastHour() {
        return this == MORNING ? 7 : 0;
    }

    public LocalDateTime requiredPublication(final LocalDate sendDate) {
        return sendDate.atTime(publicationHour, 0);
    }

    public Instant expiresAt(final LocalDate sendDate) {
        return sendDate.atTime(hour + 1, 0).atZone(KST).toInstant();
    }

    public static Optional<NotificationSlot> activeAt(final Instant instant) {
        int hour = instant.atZone(KST).getHour();
        return Arrays.stream(values()).filter(slot -> slot.hour == hour).findFirst();
    }
}
