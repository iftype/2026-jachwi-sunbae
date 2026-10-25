package com.jachwisunbae.weather.notification.scheduler;

import com.jachwisunbae.weather.notification.domain.NotificationSlot;
import com.jachwisunbae.weather.notification.service.WeatherNotificationDispatchService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
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
