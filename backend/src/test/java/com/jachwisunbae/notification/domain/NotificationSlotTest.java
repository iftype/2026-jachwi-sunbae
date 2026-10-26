package com.jachwisunbae.notification.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class NotificationSlotTest {
    @Test
    void morningUsesTodayAndEveningUsesTomorrowAcrossYearBoundary() {
        LocalDate date = LocalDate.of(2026, 12, 31);
        assertThat(NotificationSlot.MORNING.targetDate(date)).isEqualTo(date);
        assertThat(NotificationSlot.MORNING.firstForecastHour()).isEqualTo(7);
        assertThat(NotificationSlot.EVENING.targetDate(date)).isEqualTo(LocalDate.of(2027, 1, 1));
        assertThat(NotificationSlot.EVENING.firstForecastHour()).isZero();
    }
}
