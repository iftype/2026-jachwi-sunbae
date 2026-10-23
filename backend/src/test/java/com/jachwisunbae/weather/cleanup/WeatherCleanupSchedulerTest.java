package com.jachwisunbae.weather.cleanup;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.jachwisunbae.weather.service.WeatherCleanupService;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.scheduling.support.SimpleTriggerContext;

class WeatherCleanupSchedulerTest {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private final WeatherCleanupService service = mock(WeatherCleanupService.class);
    private final WeatherCleanupScheduler scheduler = new WeatherCleanupScheduler(service);

    @ParameterizedTest
    @CsvSource({
            "2026-10-23T00:29:59, 2026-10-23T00:30:00",
            "2026-10-23T00:30:00, 2026-10-24T00:30:00",
            "2026-10-23T16:00:00, 2026-10-24T00:30:00",
            "2026-12-31T23:59:59, 2027-01-01T00:30:00",
            "2028-02-28T23:59:59, 2028-02-29T00:30:00",
            "2028-02-29T23:59:59, 2028-03-01T00:30:00"
    })
    @DisplayName("시계의 시간대와 무관하게 다음 KST 00:30을 예약하고 기동 시 놓친 작업은 즉시 실행하지 않는다")
    void schedulesNextKstDay(final LocalDateTime now, final LocalDateTime expected) {
        Clock clock = Clock.fixed(now.atZone(KST).toInstant(), ZoneId.of("America/Los_Angeles"));
        assertThat(scheduler.nextExecution(new SimpleTriggerContext(clock))).isEqualTo(expected.atZone(KST).toInstant());
    }

    @Test
    @DisplayName("실행이 다음 날 예약을 넘기면 완료 이후의 다음 00:30에 실행한다")
    void usesCompletionTime() {
        Instant scheduled = Instant.parse("2026-10-22T15:30:00Z");
        Instant completed = Instant.parse("2026-10-23T16:00:00Z");
        SimpleTriggerContext context = new SimpleTriggerContext(scheduled, scheduled, completed);

        assertThat(scheduler.nextExecution(context)).isEqualTo(Instant.parse("2026-10-24T15:30:00Z"));
    }

    @Test
    @DisplayName("DB 실패를 처리하고 이후 예약에서도 공통 정리 서비스를 호출한다")
    void continuesAfterFailure() {
        when(service.cleanup()).thenThrow(new IllegalStateException("test failure")).thenReturn(null);
        assertThatCode(scheduler::cleanup).doesNotThrowAnyException();
        assertThatCode(scheduler::cleanup).doesNotThrowAnyException();
        verify(service, times(2)).cleanup();
    }
}
