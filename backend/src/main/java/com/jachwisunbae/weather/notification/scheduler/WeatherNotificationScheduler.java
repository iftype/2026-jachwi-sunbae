package com.jachwisunbae.weather.notification.scheduler;

import com.jachwisunbae.weather.notification.domain.NotificationSlot;
import com.jachwisunbae.weather.notification.service.WeatherNotificationDispatchService;
import java.util.concurrent.ScheduledFuture;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.support.CronTrigger;

public class WeatherNotificationScheduler {
    public static final String CRON = "0 */5 7,22 * * *";
    private final TaskScheduler scheduler;
    private final WeatherNotificationDispatchService dispatch;
    private ScheduledFuture<?> future;

    public WeatherNotificationScheduler(final TaskScheduler scheduler, final WeatherNotificationDispatchService dispatch) {
        this.scheduler = scheduler;
        this.dispatch = dispatch;
    }

    public void start() {
        future = scheduler.schedule(dispatch::dispatchCurrentSlot, new CronTrigger(CRON, NotificationSlot.KST));
    }

    public void stop() {
        if (future != null) {
            future.cancel(false);
        }
    }
}
