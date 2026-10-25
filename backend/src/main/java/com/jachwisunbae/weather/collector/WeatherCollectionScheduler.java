package com.jachwisunbae.weather.collector;

import com.jachwisunbae.weather.service.WeatherCollectionService;
import com.jachwisunbae.weather.service.collection.WeatherPublicationSchedule;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@ConditionalOnProperty(name = "weather.collection.enabled", havingValue = "true")
public class WeatherCollectionScheduler {
    private final WeatherCollectionService service;
    private final Clock clock;

    public WeatherCollectionScheduler(final WeatherCollectionService service, final Clock clock) {
        this.service = service;
        this.clock = clock;
    }

    @Scheduled(cron = "0 15 2,5,8,11,14,17,20,23 * * *", zone = "Asia/Seoul")
    public void collect() {
        try {
            service.collect(WeatherPublicationSchedule.latestAt(LocalDateTime.ofInstant(clock.instant(), ZoneId.of("Asia/Seoul"))));
        } catch (RuntimeException exception) {
            LoggerFactory.getLogger(getClass()).warn("weather-scheduled-collection-failed exceptionType={}",
                    exception.getClass().getSimpleName());
        }
    }
}
