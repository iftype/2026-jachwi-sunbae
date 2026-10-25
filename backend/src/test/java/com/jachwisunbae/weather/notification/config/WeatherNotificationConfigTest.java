package com.jachwisunbae.weather.notification.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

import com.google.firebase.FirebaseApp;
import com.jachwisunbae.weather.notification.provider.WeatherPushSender;
import com.jachwisunbae.weather.notification.scheduler.WeatherNotificationScheduler;
import com.jachwisunbae.weather.notification.service.WeatherNotificationDispatchService;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;

class WeatherNotificationConfigTest {
    @Test
    void defaultOffNeedsNoFirebaseCredentialsAndRegistersNoScheduler() {
        new WebApplicationContextRunner().withUserConfiguration(DisabledWeatherPushConfig.class, FirebaseWeatherPushConfig.class,
                WeatherNotificationSchedulingConfig.class).run(context -> {
                    assertThat(context).hasNotFailed().hasSingleBean(WeatherPushSender.class).doesNotHaveBean(FirebaseApp.class)
                            .doesNotHaveBean(WeatherNotificationScheduler.class);
                    assertThat(context.getBean(WeatherPushSender.class).send(null).outcome()).isEqualTo(WeatherPushSender.Outcome.DISABLED);
                });
    }

    @Test
    void enabledWithoutProjectIdFailsBeforeTryingDefaultCredentials() {
        new ApplicationContextRunner().withUserConfiguration(FirebaseWeatherPushConfig.class)
                .withPropertyValues("weather.notification.enabled=true")
                .withBean(Clock.class, Clock::systemUTC).run(context -> assertThat(context.getStartupFailure())
                        .hasRootCauseMessage("날씨 알림 활성화에는 Firebase project ID가 필요합니다."));
    }

    @Test
    void enabledWebAppSchedulesIndependentlyFromWeatherCollectionWithoutImmediateSend() {
        var dispatch = mock(WeatherNotificationDispatchService.class);
        new WebApplicationContextRunner().withUserConfiguration(WeatherNotificationSchedulingConfig.class)
                .withPropertyValues("weather.notification.enabled=true", "weather.collection.enabled=false", "weather.cleanup.enabled=false")
                .withBean(Clock.class, () -> Clock.fixed(Instant.parse("2026-10-24T23:00:00Z"), ZoneOffset.UTC))
                .withBean(WeatherNotificationDispatchService.class, () -> dispatch)
                .run(context -> {
                    assertThat(context).hasNotFailed().hasSingleBean(WeatherNotificationScheduler.class)
                            .hasBean("weatherNotificationTaskScheduler");
                    verifyNoInteractions(dispatch);
                });
    }

    @Test
    void nonWebCommandsDoNotRegisterNotificationSchedulerEvenWhenEnabled() {
        new ApplicationContextRunner().withUserConfiguration(WeatherNotificationSchedulingConfig.class)
                .withPropertyValues("weather.notification.enabled=true")
                .run(context -> assertThat(context).hasNotFailed().doesNotHaveBean(WeatherNotificationScheduler.class));
    }
}
