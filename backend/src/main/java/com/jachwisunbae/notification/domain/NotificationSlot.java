package com.jachwisunbae.notification.domain;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

public enum NotificationSlot {
    MORNING, EVENING;

    public static final ZoneId KST = ZoneId.of("Asia/Seoul");

    public LocalDate targetDate(final LocalDate sendDate) {
        return this == MORNING ? sendDate : sendDate.plusDays(1);
    }

    public int firstForecastHour() {
        return this == MORNING ? 7 : 0;
    }

    public LocalDateTime requiredPublication(final LocalDate sendDate) {
        return sendDate.atTime(this == MORNING ? 5 : 20, 0);
    }
}
