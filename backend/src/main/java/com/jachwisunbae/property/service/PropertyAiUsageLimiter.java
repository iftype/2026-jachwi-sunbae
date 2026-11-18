package com.jachwisunbae.property.service;

import com.jachwisunbae.common.exception.client.RateLimitExceededException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.stereotype.Component;

// Bedrock 호출 비용을 막기 위한 회원별 이미지 분석 횟수 제한이다.
// 서버 메모리에만 기록하므로 재시작하면 초기화되고, 서버가 여러 대면 서버마다 따로 센다.
@Component
public class PropertyAiUsageLimiter {

    static final int MINUTE_LIMIT = 3;
    static final int DAILY_LIMIT = 30;
    static final int MONTHLY_LIMIT = 300;
    private static final Duration MINUTE_WINDOW = Duration.ofSeconds(60);
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    private final Map<Long, Usage> usages = new ConcurrentHashMap<>();
    private final AtomicReference<YearMonth> lastSweptMonth = new AtomicReference<>();
    private final Clock clock;

    public PropertyAiUsageLimiter(final Clock clock) {
        this.clock = clock;
    }

    public void acquire(final Long memberId) {
        Instant now = clock.instant();
        LocalDate today = LocalDate.ofInstant(now, SEOUL);
        sweepPastMonths(YearMonth.from(today));
        // compute는 같은 회원에 대해 한 번에 하나씩 실행되므로 동시 요청에서도 확인과 증가 사이에 다른 요청이 끼어들지 않는다.
        // 한도를 넘으면 예외가 compute 밖으로 전파되고 횟수는 늘지 않는다.
        usages.compute(memberId, (id, usage) -> {
            Usage current = usage == null ? new Usage() : usage;
            current.acquire(memberId, now, today);
            return current;
        });
    }

    // 월간 횟수가 초기화된 지난달 기록은 더 볼 필요가 없으므로 달이 바뀐 뒤 첫 요청에서 지운다.
    // 그래서 메모리에는 이번 달에 이미지 분석을 쓴 회원의 기록만 남는다.
    private void sweepPastMonths(final YearMonth currentMonth) {
        YearMonth swept = lastSweptMonth.get();
        if (currentMonth.equals(swept) || !lastSweptMonth.compareAndSet(swept, currentMonth)) {
            return;
        }
        for (Long memberId : usages.keySet()) {
            usages.computeIfPresent(memberId, (id, usage) -> usage.isBefore(currentMonth) ? null : usage);
        }
    }

    // compute 안에서만 읽고 바꾸므로 따로 동기화하지 않는다.
    private static final class Usage {

        private final Deque<Instant> recentCalls = new ArrayDeque<>();
        private LocalDate day;
        private int dailyCount;
        private YearMonth month;
        private int monthlyCount;

        private void acquire(final Long memberId, final Instant now, final LocalDate today) {
            resetExpired(now, today);
            // 기간이 긴 제한부터 확인해 사용자가 가장 오래 기다려야 하는 이유를 알린다.
            if (monthlyCount >= MONTHLY_LIMIT) {
                throw exceeded(ErrorCode.PROPERTY_AI_MONTHLY_LIMIT_EXCEEDED, memberId, "월간");
            }
            if (dailyCount >= DAILY_LIMIT) {
                throw exceeded(ErrorCode.PROPERTY_AI_DAILY_LIMIT_EXCEEDED, memberId, "일간");
            }
            if (recentCalls.size() >= MINUTE_LIMIT) {
                throw exceeded(ErrorCode.PROPERTY_AI_MINUTE_LIMIT_EXCEEDED, memberId, "분당");
            }
            recentCalls.addLast(now);
            dailyCount++;
            monthlyCount++;
        }

        private void resetExpired(final Instant now, final LocalDate today) {
            YearMonth thisMonth = YearMonth.from(today);
            if (!thisMonth.equals(month)) {
                month = thisMonth;
                monthlyCount = 0;
            }
            if (!today.equals(day)) {
                day = today;
                dailyCount = 0;
            }
            Instant windowStart = now.minus(MINUTE_WINDOW);
            while (!recentCalls.isEmpty() && !recentCalls.peekFirst().isAfter(windowStart)) {
                recentCalls.pollFirst();
            }
        }

        private boolean isBefore(final YearMonth currentMonth) {
            return month.isBefore(currentMonth);
        }

        private RateLimitExceededException exceeded(final ErrorCode errorCode, final Long memberId,
                                                    final String period) {
            return new RateLimitExceededException(errorCode,
                    "memberId=" + memberId + " 이미지 분석 " + period + " 한도 초과");
        }
    }
}
