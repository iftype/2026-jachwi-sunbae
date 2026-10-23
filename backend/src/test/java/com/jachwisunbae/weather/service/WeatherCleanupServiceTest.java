package com.jachwisunbae.weather.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.jachwisunbae.weather.repository.JdbcWeatherForecastRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@ExtendWith(OutputCaptureExtension.class)
class WeatherCleanupServiceTest {

    private final JdbcWeatherForecastRepository repository = mock(JdbcWeatherForecastRepository.class);
    private final PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
    private final Clock clock = mock(Clock.class);

    @Test
    @DisplayName("설정 OFF이면 조회·삭제·트랜잭션 시작 전에 거부한다")
    void disabled() {
        assertThatThrownBy(() -> service(false).cleanup()).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("weather.cleanup.enabled=true");
        verifyNoInteractions(repository, transactions, clock);
    }

    @ParameterizedTest
    @CsvSource({
            "2026-10-22T14:59:59Z, 2026-10-22", "2026-10-22T15:00:00Z, 2026-10-23",
            "2026-12-31T15:00:00Z, 2027-01-01", "2028-02-28T15:00:00Z, 2028-02-29",
            "2028-02-29T15:00:00Z, 2028-03-01"
    })
    @DisplayName("UTC·월말·연말·윤년 경계에서도 KST 오늘 00시를 보존 기준으로 사용한다")
    void usesKstDate(final Instant now, final LocalDate expected) {
        WeatherCleanupService service = new WeatherCleanupService(repository, transactions,
                Clock.fixed(now, ZoneId.of("America/Los_Angeles")), true);

        assertThat(service.cleanup().retainedFrom()).isEqualTo(expected);

        verify(repository).deleteHourlyBefore(expected.atStartOfDay());
        verify(repository).deleteDailyBefore(expected);
    }

    @Test
    @DisplayName("자정을 넘어 끝나도 시작 날짜를 유지하고 커밋 후 행 수·종료 시각을 반환한다")
    void fixesCutoffAtStart(final CapturedOutput output) {
        Instant start = Instant.parse("2026-10-22T14:59:59Z");
        Instant finish = Instant.parse("2026-10-22T15:00:02Z");
        when(clock.instant()).thenReturn(start, finish);
        when(repository.countHourly()).thenReturn(12L, 8L);
        when(repository.countDaily()).thenReturn(6L, 4L);
        when(repository.deleteHourlyBefore(any())).thenReturn(4);
        when(repository.deleteDailyBefore(any())).thenReturn(2);

        var result = service(true).cleanup();

        assertThat(result.retainedFrom()).isEqualTo(LocalDate.of(2026, 10, 22));
        assertThat(result.startedAt()).isEqualTo(start);
        assertThat(result.finishedAt()).isEqualTo(finish);
        assertThat(result.hourly().beforeRows()).isEqualTo(12);
        assertThat(result.hourly().deletedRows()).isEqualTo(4);
        assertThat(result.hourly().afterRows()).isEqualTo(8);
        assertThat(result.daily().deletedRows()).isEqualTo(2);
        assertThat(result.elapsedNanos()).isPositive();
        verify(transactions).commit(any());
        assertThat(output).contains("status=SUCCEEDED", "hourlyBefore=12 hourlyDeleted=4 hourlyAfter=8",
                "dailyBefore=6 dailyDeleted=2 dailyAfter=4", "elapsedNanos=");
    }

    @Test
    @DisplayName("커밋 실패를 성공으로 기록하지 않으며 다음 실행에서는 다시 정리할 수 있다")
    void releasesAfterCommitFailure(final CapturedOutput output) {
        when(clock.instant()).thenReturn(Instant.parse("2026-10-22T15:30:00Z"));
        IllegalStateException failure = new IllegalStateException("commit failure");
        doThrow(failure).doNothing().when(transactions).commit(any());
        WeatherCleanupService service = service(true);

        assertThatThrownBy(service::cleanup).isSameAs(failure);
        assertThat(output).contains("status=FAILED").doesNotContain("status=SUCCEEDED");
        assertThat(service.cleanup().hourly().deletedRows()).isZero();
    }

    @Test
    @DisplayName("외부 트랜잭션에서는 커밋 완료를 보장할 수 없으므로 정리를 거부한다")
    void rejectsOuterTransaction() {
        TransactionSynchronizationManager.setActualTransactionActive(true);
        try {
            assertThatThrownBy(() -> service(true).cleanup()).hasMessageContaining("외부 DB 트랜잭션");
            verifyNoInteractions(repository, transactions);
        } finally {
            TransactionSynchronizationManager.setActualTransactionActive(false);
        }
    }

    @Test
    @DisplayName("같은 서비스의 중첩 정리는 거부하고 완료 후 다시 실행할 수 있다")
    void rejectsConcurrentCleanup() throws Exception {
        when(clock.instant()).thenReturn(Instant.parse("2026-10-22T15:30:00Z"));
        CountDownLatch entered = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        when(repository.countHourly()).thenAnswer(invocation -> {
            entered.countDown();
            assertThat(release.await(5, TimeUnit.SECONDS)).isTrue();
            return 0L;
        });
        WeatherCleanupService service = service(true);
        try (var executor = Executors.newSingleThreadExecutor()) {
            var task = executor.submit(service::cleanup);
            try {
                assertThat(entered.await(5, TimeUnit.SECONDS)).isTrue();
                assertThatThrownBy(service::cleanup).hasMessage("이미 날씨 정리가 실행 중입니다.");
            } finally {
                release.countDown();
            }
            assertThat(task.get(5, TimeUnit.SECONDS).hourly().deletedRows()).isZero();
        }
        assertThat(service.cleanup().hourly().deletedRows()).isZero();
    }

    private WeatherCleanupService service(final boolean enabled) {
        return new WeatherCleanupService(repository, transactions, clock, enabled);
    }
}
