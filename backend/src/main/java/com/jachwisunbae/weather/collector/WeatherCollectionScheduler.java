package com.jachwisunbae.weather.collector;

import com.jachwisunbae.weather.service.WeatherCollectionService;
import com.jachwisunbae.weather.service.collection.WeatherPublicationSchedule;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.TriggerContext;

public class WeatherCollectionScheduler {

    private static final Logger LOG = LoggerFactory.getLogger(WeatherCollectionScheduler.class);
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final WeatherCollectionService service;
    private final Clock clock;
    private final WeatherPublicationSchedule schedule;

    public WeatherCollectionScheduler(final WeatherCollectionService service, final Clock clock,
                                      final Duration publicationDelay) {
        this.service = service;
        this.clock = clock;
        this.schedule = new WeatherPublicationSchedule(publicationDelay);
    }

    // 다음 실행시간 계산
    //현재시각, 직전 예약시간, 직전 실제 시작 시각, 직전 완료 시간 중 최댓값 사용
    public Instant nextExecution(final TriggerContext context) {
        Instant after = clock.instant();
        // 완료 후 다음 시각을 계산한다. 시계가 뒤로 조정되어도 같은 예약을 반복하지 않는다.
        for (Instant previous : new Instant[]{context.lastScheduledExecution(), context.lastActualExecution(),
                context.lastCompletion()}) {
            if (previous != null && previous.isAfter(after)) {
                after = previous;
            }
        }
        Instant next = schedule.nextCollectionAfter(LocalDateTime.ofInstant(after, KST)).atZone(KST).toInstant();
        LOG.info("weather-collection-scheduled nextExecutionAt={} zone={}", next, KST);
        return next;
    }

    public void collect() {
        try {
            service.collectAutomatically();
        } catch (RuntimeException exception) {
            // 서비스가 FAILED 상태를 기록한다. 메시지·cause의 URL 또는 키를 노출하지 않는다.
            LOG.warn("weather-scheduled-collection-failed exceptionType={}", exception.getClass().getSimpleName());
        }
    }
}
