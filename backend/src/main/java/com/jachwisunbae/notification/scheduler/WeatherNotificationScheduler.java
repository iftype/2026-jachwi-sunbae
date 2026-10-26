package com.jachwisunbae.notification.scheduler;

import com.jachwisunbae.notification.domain.NotificationSlot;
import com.jachwisunbae.notification.service.WeatherNotificationDispatchService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "weather.notification.enabled", havingValue = "true")
public class WeatherNotificationScheduler {
    private final WeatherNotificationDispatchService service;

    public WeatherNotificationScheduler(final WeatherNotificationDispatchService service) {
        this.service = service;
    }

    @Scheduled(cron = "0 0 7 * * *", zone = "Asia/Seoul")
    public void morning() {
        service.dispatch(NotificationSlot.MORNING);
    }

    @Scheduled(cron = "0 0 22 * * *", zone = "Asia/Seoul")
    public void evening() {
        service.dispatch(NotificationSlot.EVENING);
    }
}
