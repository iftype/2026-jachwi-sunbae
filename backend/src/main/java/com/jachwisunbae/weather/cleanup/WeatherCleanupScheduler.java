package com.jachwisunbae.weather.cleanup;

import com.jachwisunbae.weather.service.WeatherCleanupService;
import java.time.Instant;
import java.time.ZoneId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.TriggerContext;
import org.springframework.scheduling.support.CronTrigger;

public class WeatherCleanupScheduler {

    private static final Logger LOG = LoggerFactory.getLogger(WeatherCleanupScheduler.class);
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private final CronTrigger trigger = new CronTrigger("0 30 0 * * *", KST);
    private final WeatherCleanupService service;

    public WeatherCleanupScheduler(final WeatherCleanupService service) {
        this.service = service;
    }

    public Instant nextExecution(final TriggerContext context) {
        // TriggerContext에는 공통 TaskScheduler에 주입한 Clock과 직전 완료 시각이 들어 있다.
        Instant next = trigger.nextExecution(context);
        LOG.info("weather-cleanup-scheduled nextExecutionAt={} zone={}", next, KST);
        return next;
    }

    public void cleanup() {
        try {
            service.cleanup();
        } catch (RuntimeException exception) {
            LOG.warn("weather-scheduled-cleanup-failed exceptionType={}", exception.getClass().getSimpleName());
        }
    }
}
