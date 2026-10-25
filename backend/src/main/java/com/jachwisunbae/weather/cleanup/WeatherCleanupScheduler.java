package com.jachwisunbae.weather.cleanup;

import com.jachwisunbae.weather.service.WeatherCleanupService;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@ConditionalOnProperty(name = "weather.cleanup.enabled", havingValue = "true")
public class WeatherCleanupScheduler {
    private final WeatherCleanupService service;

    public WeatherCleanupScheduler(final WeatherCleanupService service) {
        this.service = service;
    }

    @Scheduled(cron = "0 30 0 * * *", zone = "Asia/Seoul")
    public void cleanup() {
        try {
            service.cleanup();
        } catch (RuntimeException exception) {
            LoggerFactory.getLogger(getClass()).warn("weather-scheduled-cleanup-failed exceptionType={}",
                    exception.getClass().getSimpleName());
        }
    }
}
