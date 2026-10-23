package com.jachwisunbae.weather.collector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.jachwisunbae.weather.service.WeatherCollectionService;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.scheduling.support.SimpleTriggerContext;

class WeatherCollectionSchedulerTest {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private final WeatherCollectionService service = mock(WeatherCollectionService.class);

    @ParameterizedTest
    @ValueSource(ints = {2, 5, 8, 11, 14, 17, 20, 23})
    @DisplayName("8개 KST 발표시각에서 대기시간이 지난 시점에 실행하며 이미 지난 시각을 즉시 재실행하지 않는다")
    void schedulesEightPublications(final int hour) {
        Instant due = LocalDateTime.of(2026, 10, 23, hour, 15).atZone(KST).toInstant();
        assertThat(scheduler(due.minusNanos(1), 15).nextExecution(new SimpleTriggerContext())).isEqualTo(due);
        assertThat(scheduler(due, 15).nextExecution(new SimpleTriggerContext())).isEqualTo(due.plusSeconds(3 * 3600));
    }

    @ParameterizedTest
    @CsvSource({
            "2026-12-31T23:16:00, 15, 2027-01-01T02:15:00",
            "2028-02-29T23:59:59, 15, 2028-03-01T02:15:00",
            "2026-10-23T23:59:59, 90, 2026-10-24T00:30:00",
            "2026-10-23T01:59:59, 0, 2026-10-23T02:00:00"
    })
    @DisplayName("날짜·윤년 경계와 한 시간을 넘는 대기시간도 KST로 계산한다")
    void schedulesAcrossDateAndDelayBoundaries(final LocalDateTime now, final long delay,
                                               final LocalDateTime expected) {
        assertThat(scheduler(now.atZone(KST).toInstant(), delay).nextExecution(new SimpleTriggerContext()))
                .isEqualTo(expected.atZone(KST).toInstant());
    }

    @Test
    @DisplayName("실행이 다음 발표분까지 길어지면 완료 이후의 다음 시각을 예약한다")
    void skipsMissedExecutionAfterLongCollection() {
        Instant scheduled = Instant.parse("2026-10-22T17:15:00Z");
        Instant completed = Instant.parse("2026-10-22T21:00:00Z");
        SimpleTriggerContext context = new SimpleTriggerContext(scheduled, scheduled, completed);

        assertThat(scheduler(completed, 15).nextExecution(context)).isEqualTo(Instant.parse("2026-10-22T23:15:00Z"));
    }

    @Test
    @DisplayName("시계가 뒤로 조정되어도 직전 예약을 반복하지 않는다")
    void handlesClockMovingBackwards() {
        Instant scheduled = Instant.parse("2026-10-22T17:15:00Z");
        SimpleTriggerContext context = new SimpleTriggerContext(scheduled, scheduled.minusSeconds(5), scheduled.minusSeconds(1));

        assertThat(scheduler(scheduled.minusSeconds(60), 15).nextExecution(context))
                .isEqualTo(scheduled.plusSeconds(3 * 3600));
    }

    @Test
    @DisplayName("수집 실패를 성공으로 바꾸지 않고 다음 예약에서도 공통 서비스를 호출한다")
    void continuesAfterFailure() {
        when(service.collectAutomatically()).thenThrow(new IllegalStateException("test upstream failure"))
                .thenReturn(Optional.empty());
        WeatherCollectionScheduler scheduler = scheduler(Instant.parse("2026-10-22T17:15:00Z"), 15);

        assertThatCode(scheduler::collect).doesNotThrowAnyException();
        assertThatCode(scheduler::collect).doesNotThrowAnyException();

        verify(service, times(2)).collectAutomatically();
    }

    private WeatherCollectionScheduler scheduler(final Instant now, final long delay) {
        return new WeatherCollectionScheduler(service, Clock.fixed(now, ZoneId.of("America/Los_Angeles")),
                Duration.ofMinutes(delay));
    }
}
