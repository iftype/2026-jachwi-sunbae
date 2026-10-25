package com.jachwisunbae.weather.notification.config;

import com.jachwisunbae.weather.notification.scheduler.WeatherNotificationScheduler;
import com.jachwisunbae.weather.notification.service.WeatherNotificationDispatchService;
import java.time.Clock;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "weather.notification.enabled", havingValue = "true")
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class WeatherNotificationSchedulingConfig {
    @Bean
    public ThreadPoolTaskScheduler weatherNotificationTaskScheduler(final Clock clock) {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setClock(clock);
        scheduler.setThreadNamePrefix("weather-notification-");
        scheduler.setErrorHandler(exception -> LoggerFactory.getLogger(WeatherNotificationSchedulingConfig.class)
                .error("weather-notification-scheduler-failed exceptionType={}", exception.getClass().getSimpleName()));
        return scheduler;
    }

    @Bean(initMethod = "start", destroyMethod = "stop")
    public WeatherNotificationScheduler weatherNotificationScheduler(
            @Qualifier("weatherNotificationTaskScheduler") final TaskScheduler scheduler, final WeatherNotificationDispatchService dispatch) {
        // 수집 스케줄러의 작업 등록기·스레드와 독립적으로 예약한다.
        return new WeatherNotificationScheduler(scheduler, dispatch);
    }
}
