package com.jachwisunbae.weather.notification.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.google.firebase.FirebaseApp;
import com.jachwisunbae.weather.notification.provider.WeatherPushSender;
import java.time.Clock;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class WeatherNotificationConfigTest {
    @Test
    void offNeedsNoFirebaseCredentials() {
        new ApplicationContextRunner().withUserConfiguration(DisabledWeatherPushConfig.class, FirebaseWeatherPushConfig.class)
                .run(context -> {
                    assertThat(context).hasNotFailed().hasSingleBean(WeatherPushSender.class).doesNotHaveBean(FirebaseApp.class);
                    assertThat(context.getBean(WeatherPushSender.class).send(null)).isFalse();
                });
    }

    @Test
    void onRequiresProjectIdBeforeLoadingCredentials() {
        new ApplicationContextRunner().withUserConfiguration(FirebaseWeatherPushConfig.class)
                .withPropertyValues("weather.notification.enabled=true").withBean(Clock.class, Clock::systemUTC)
                .run(context -> assertThat(context.getStartupFailure()).hasRootCauseMessage("날씨 알림 활성화에는 Firebase project ID가 필요합니다."));
    }
}
