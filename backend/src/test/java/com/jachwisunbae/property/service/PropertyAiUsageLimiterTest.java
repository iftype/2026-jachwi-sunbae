package com.jachwisunbae.property.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.common.exception.client.RateLimitExceededException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PropertyAiUsageLimiterTest {

    private static final long MEMBER_ID = 1L;
    private static final long OTHER_MEMBER_ID = 2L;
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    // 분당 한도에 걸리지 않도록 호출 사이에 둔다.
    private static final Duration AFTER_MINUTE_WINDOW = Duration.ofSeconds(61);
    // 매일 일간 한도까지 쓰면 월간 한도에 닿는 날 수다.
    private static final int DAYS_TO_REACH_MONTHLY_LIMIT =
            PropertyAiUsageLimiter.MONTHLY_LIMIT / PropertyAiUsageLimiter.DAILY_LIMIT;

    private final MutableClock clock = new MutableClock(seoul(2026, 11, 18, 9, 0));
    private final PropertyAiUsageLimiter limiter = new PropertyAiUsageLimiter(clock);

    @Test
    @DisplayName("최근 60초 동안 3번을 넘으면 차단하고 60초가 지나면 다시 허용한다")
    void limitsCallsInLastMinute() {
        // given
        acquireAtSameTime(MEMBER_ID, PropertyAiUsageLimiter.MINUTE_LIMIT);

        // when & then
        assertExceeded(MEMBER_ID, ErrorCode.PROPERTY_AI_MINUTE_LIMIT_EXCEEDED);
        clock.advance(Duration.ofSeconds(59));
        assertExceeded(MEMBER_ID, ErrorCode.PROPERTY_AI_MINUTE_LIMIT_EXCEEDED);
        clock.advance(Duration.ofSeconds(1));
        assertThatCode(() -> limiter.acquire(MEMBER_ID)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("하루에 30번을 넘으면 차단한다")
    void limitsDailyCalls() {
        // given
        acquireSpacedOut(MEMBER_ID, PropertyAiUsageLimiter.DAILY_LIMIT);

        // when & then
        assertExceeded(MEMBER_ID, ErrorCode.PROPERTY_AI_DAILY_LIMIT_EXCEEDED);
    }

    @Test
    @DisplayName("한 달에 300번을 넘으면 날이 바뀌어도 차단한다")
    void limitsMonthlyCalls() {
        // given
        for (int day = 1; day <= DAYS_TO_REACH_MONTHLY_LIMIT; day++) {
            clock.set(seoul(2026, 11, day, 9, 0));
            acquireSpacedOut(MEMBER_ID, PropertyAiUsageLimiter.DAILY_LIMIT);
        }

        // when
        clock.set(seoul(2026, 11, DAYS_TO_REACH_MONTHLY_LIMIT + 1, 9, 0));

        // then
        assertExceeded(MEMBER_ID, ErrorCode.PROPERTY_AI_MONTHLY_LIMIT_EXCEEDED);
    }

    @Test
    @DisplayName("차단된 요청은 횟수에 포함하지 않는다")
    void doesNotCountRejectedCalls() {
        // given
        acquireAtSameTime(MEMBER_ID, PropertyAiUsageLimiter.MINUTE_LIMIT);
        assertExceeded(MEMBER_ID, ErrorCode.PROPERTY_AI_MINUTE_LIMIT_EXCEEDED);
        clock.advance(AFTER_MINUTE_WINDOW);

        // when & then
        acquireSpacedOut(MEMBER_ID, PropertyAiUsageLimiter.DAILY_LIMIT - PropertyAiUsageLimiter.MINUTE_LIMIT);
        assertExceeded(MEMBER_ID, ErrorCode.PROPERTY_AI_DAILY_LIMIT_EXCEEDED);
    }

    @Test
    @DisplayName("회원마다 횟수를 따로 센다")
    void countsEachMemberSeparately() {
        // given
        acquireAtSameTime(MEMBER_ID, PropertyAiUsageLimiter.MINUTE_LIMIT);

        // when & then
        assertExceeded(MEMBER_ID, ErrorCode.PROPERTY_AI_MINUTE_LIMIT_EXCEEDED);
        assertThatCode(() -> acquireAtSameTime(OTHER_MEMBER_ID, PropertyAiUsageLimiter.MINUTE_LIMIT))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("일간 횟수는 UTC가 아니라 한국 시간 자정에 초기화한다")
    void resetsDailyCountAtSeoulMidnight() {
        // given
        clock.set(seoul(2026, 11, 18, 23, 0));
        acquireSpacedOut(MEMBER_ID, PropertyAiUsageLimiter.DAILY_LIMIT);
        assertExceeded(MEMBER_ID, ErrorCode.PROPERTY_AI_DAILY_LIMIT_EXCEEDED);

        // when
        // 한국 시간 11월 19일 0시는 UTC로 아직 11월 18일 15시다.
        clock.set(seoul(2026, 11, 19, 0, 0));

        // then
        assertThatCode(() -> limiter.acquire(MEMBER_ID)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("월간 횟수는 한국 시간으로 다음 달 1일 0시에 초기화한다")
    void resetsMonthlyCountAtSeoulMonthStart() {
        // given
        for (int day = 31 - DAYS_TO_REACH_MONTHLY_LIMIT; day <= 30; day++) {
            clock.set(seoul(2026, 11, day, 9, 0));
            acquireSpacedOut(MEMBER_ID, PropertyAiUsageLimiter.DAILY_LIMIT);
        }
        clock.set(seoul(2026, 11, 30, 23, 59));
        assertExceeded(MEMBER_ID, ErrorCode.PROPERTY_AI_MONTHLY_LIMIT_EXCEEDED);

        // when
        clock.set(seoul(2026, 12, 1, 0, 0));

        // then
        assertThatCode(() -> limiter.acquire(MEMBER_ID)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("같은 회원의 요청이 동시에 몰려도 분당 한도만큼만 허용한다")
    void allowsOnlyLimitUnderConcurrentCalls() throws Exception {
        // given
        int requestCount = 50;
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger allowed = new AtomicInteger();
        AtomicInteger rejected = new AtomicInteger();
        Callable<Void> request = () -> {
            start.await();
            try {
                limiter.acquire(MEMBER_ID);
                allowed.incrementAndGet();
            } catch (RateLimitExceededException exception) {
                rejected.incrementAndGet();
            }
            return null;
        };
        ExecutorService executor = Executors.newFixedThreadPool(16);

        // when
        try {
            List<Future<Void>> futures = new ArrayList<>();
            for (int i = 0; i < requestCount; i++) {
                futures.add(executor.submit(request));
            }
            start.countDown();
            for (Future<Void> future : futures) {
                future.get(10, TimeUnit.SECONDS);
            }
        } finally {
            executor.shutdownNow();
        }

        // then
        assertThat(allowed).hasValue(PropertyAiUsageLimiter.MINUTE_LIMIT);
        assertThat(rejected).hasValue(requestCount - PropertyAiUsageLimiter.MINUTE_LIMIT);
    }

    private void acquireAtSameTime(final long memberId, final int count) {
        for (int i = 0; i < count; i++) {
            limiter.acquire(memberId);
        }
    }

    private void acquireSpacedOut(final long memberId, final int count) {
        for (int i = 0; i < count; i++) {
            limiter.acquire(memberId);
            clock.advance(AFTER_MINUTE_WINDOW);
        }
    }

    private void assertExceeded(final long memberId, final ErrorCode errorCode) {
        assertThatThrownBy(() -> limiter.acquire(memberId))
                .isInstanceOfSatisfying(RateLimitExceededException.class,
                        exception -> assertThat(exception.getErrorCode()).isEqualTo(errorCode));
    }

    private static Instant seoul(final int year, final int month, final int day, final int hour, final int minute) {
        return LocalDateTime.of(year, month, day, hour, minute).atZone(SEOUL).toInstant();
    }

    private static final class MutableClock extends Clock {

        private Instant now;

        private MutableClock(final Instant now) {
            this.now = now;
        }

        private void set(final Instant instant) {
            now = instant;
        }

        private void advance(final Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(final ZoneId zone) {
            return Clock.fixed(now, zone);
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
