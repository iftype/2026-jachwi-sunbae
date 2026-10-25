package com.jachwisunbae.weather.notification.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.jachwisunbae.weather.notification.scheduler.WeatherNotificationScheduler;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.scheduling.support.CronExpression;

class NotificationSlotTest {
    @ParameterizedTest
    @CsvSource({"2026-12-31T21:59:59Z,NONE", "2026-12-31T22:00:00Z,MORNING", "2026-12-31T22:59:59Z,MORNING",
            "2026-12-31T23:00:00Z,NONE", "2026-12-31T12:59:59Z,NONE", "2026-12-31T13:00:00Z,EVENING",
            "2026-12-31T13:59:59Z,EVENING", "2026-12-31T14:00:00Z,NONE"})
    void activeSlotUsesKstHalfOpenHourWindow(final Instant instant, final String expected) {
        assertThat(NotificationSlot.activeAt(instant).map(Enum::name).orElse("NONE")).isEqualTo(expected);
    }

    @Test
    void eveningTargetCrossesYearButPublicationAndDedupDateRemainSendDate() {
        var date = LocalDate.of(2026, 12, 31);
        assertThat(NotificationSlot.EVENING.targetDate(date)).isEqualTo(LocalDate.of(2027, 1, 1));
        assertThat(NotificationSlot.EVENING.requiredPublication(date)).isEqualTo(date.atTime(20, 0));
        assertThat(NotificationSlot.MORNING.requiredPublication(date)).isEqualTo(date.atTime(5, 0));
        assertThat(NotificationSlot.EVENING.expiresAt(date)).isEqualTo(Instant.parse("2026-12-31T14:00:00Z"));
    }

    @Test
    void cronStartsAtSevenAndTwentyTwoAndRetriesOnlyWithinThoseHours() {
        var cron = CronExpression.parse(WeatherNotificationScheduler.CRON);
        var start = Instant.parse("2026-12-31T21:59:59Z").atZone(NotificationSlot.KST);
        assertThat(cron.next(start).toInstant()).isEqualTo(Instant.parse("2026-12-31T22:00:00Z"));
        var lastMorning = Instant.parse("2026-12-31T22:55:00Z").atZone(NotificationSlot.KST);
        assertThat(cron.next(lastMorning).toInstant()).isEqualTo(Instant.parse("2027-01-01T13:00:00Z"));
    }
}
