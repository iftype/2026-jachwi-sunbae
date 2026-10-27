package com.jachwisunbae.weather.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

import com.jachwisunbae.weather.cleanup.WeatherCleanupScheduler;
import com.jachwisunbae.weather.collector.WeatherCollectionScheduler;
import com.jachwisunbae.notification.scheduler.WeatherNotificationScheduler;
import com.jachwisunbae.notification.service.WeatherNotificationDispatchService;
import com.jachwisunbae.weather.service.WeatherCleanupService;
import com.jachwisunbae.weather.service.WeatherCollectionService;
import java.time.Clock;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.annotation.ScheduledAnnotationBeanPostProcessor;

class WeatherSchedulingConfigTest {
    private final WeatherCollectionService collection = mock(WeatherCollectionService.class);
    private final WeatherCleanupService cleanup = mock(WeatherCleanupService.class);
    private final WeatherNotificationDispatchService notification = mock(WeatherNotificationDispatchService.class);
    private final WebApplicationContextRunner runner = new WebApplicationContextRunner()
            .withUserConfiguration(WeatherSchedulingConfig.class, WeatherCollectionScheduler.class,
                    WeatherCleanupScheduler.class, WeatherNotificationScheduler.class)
            .withBean(Clock.class, Clock::systemUTC)
            .withBean(WeatherCollectionService.class, () -> collection)
            .withBean(WeatherCleanupService.class, () -> cleanup)
            .withBean(WeatherNotificationDispatchService.class, () -> notification);

    @Test
    void allJobsAreOffByDefault() {
        runner.run(context -> {
            assertThat(context).hasNotFailed().doesNotHaveBean(WeatherCollectionScheduler.class)
                    .doesNotHaveBean(WeatherCleanupScheduler.class).doesNotHaveBean(WeatherNotificationScheduler.class);
            assertThat(context.getBean(ScheduledAnnotationBeanPostProcessor.class).getScheduledTasks()).isEmpty();
            verifyNoInteractions(collection, cleanup, notification);
        });
    }

    @Test
    void localProfileRegistersNoJobsWithoutExternalCredentials() {
        profile("local").run(context -> {
            assertThat(context).hasNotFailed().doesNotHaveBean(WeatherCollectionScheduler.class)
                    .doesNotHaveBean(WeatherCleanupScheduler.class).doesNotHaveBean(WeatherNotificationScheduler.class);
            assertThat(context.getBean(ScheduledAnnotationBeanPostProcessor.class).getScheduledTasks()).isEmpty();
            assertThat(context.getEnvironment().getProperty("weather.kma.api-key")).isEmpty();
            verifyNoInteractions(collection, cleanup, notification);
        });
    }

    @ParameterizedTest
    @CsvSource({"dev, jachwi-sunbae-de, true", "prod, jachwi-sunbae-prod, false"})
    void serverProfilesCollectAndCleanAndNotifyOnlyInDev(final String profile, final String projectId,
            final boolean notifies) {
        profile(profile).run(context -> {
            assertThat(context).hasNotFailed().hasSingleBean(WeatherCollectionScheduler.class)
                    .hasSingleBean(WeatherCleanupScheduler.class);
            assertThat(context.getBeansOfType(WeatherNotificationScheduler.class)).hasSize(notifies ? 1 : 0);
            assertThat(context.getBean(ScheduledAnnotationBeanPostProcessor.class).getScheduledTasks())
                    .hasSize(notifies ? 4 : 2);
            assertThat(context.getEnvironment().getProperty("weather.notification.enabled", Boolean.class))
                    .isEqualTo(notifies);
            assertThat(context.getEnvironment().getProperty("weather.notification.firebase-project-id")).isEqualTo(projectId);
            assertThat(context.getEnvironment().getProperty("server.port", Integer.class)).isEqualTo(80);
            verifyNoInteractions(collection, cleanup, notification);
        });
    }

    @ParameterizedTest
    @ValueSource(strings = {"dev", "prod"})
    void enablingPreparedNotificationsRegistersAllThreeSchedulers(final String profile) {
        // 실제 Firebase에 연결하지 않고 서비스 대역으로 YAML의 enabled=true 전환만 검증한다.
        profile(profile).withPropertyValues("weather.notification.enabled=true").run(context -> {
            assertThat(context).hasNotFailed().hasSingleBean(WeatherCollectionScheduler.class)
                    .hasSingleBean(WeatherCleanupScheduler.class).hasSingleBean(WeatherNotificationScheduler.class);
            assertThat(context.getBean(ScheduledAnnotationBeanPostProcessor.class).getScheduledTasks()).hasSize(4);
            verifyNoInteractions(collection, cleanup, notification);
        });
    }

    @Test
    void eachFlagRegistersOnlyItsOwnJobs() {
        for (String feature : new String[]{"collection", "cleanup", "notification"}) {
            runner.withPropertyValues("weather." + feature + ".enabled=true").run(context -> {
                assertThat(context).hasNotFailed();
                assertThat(context.getBean(ScheduledAnnotationBeanPostProcessor.class).getScheduledTasks())
                        .hasSize(feature.equals("notification") ? 2 : 1);
                verifyNoInteractions(collection, cleanup, notification);
            });
        }
    }

    @Test
    void usesStandardKstCronsWithoutRetryPolling() throws Exception {
        cron(WeatherCollectionScheduler.class, "collect", "0 15 2,5,8,11,14,17,20,23 * * *");
        cron(WeatherCleanupScheduler.class, "cleanup", "0 30 0 * * *");
        cron(WeatherNotificationScheduler.class, "morning", "0 0 7 * * *");
        cron(WeatherNotificationScheduler.class, "evening", "0 0 22 * * *");
    }

    private void cron(final Class<?> type, final String method, final String expected) throws Exception {
        Scheduled schedule = type.getMethod(method).getAnnotation(Scheduled.class);
        assertThat(schedule.cron()).isEqualTo(expected);
        assertThat(schedule.zone()).isEqualTo("Asia/Seoul");
    }

    private WebApplicationContextRunner profile(final String name) {
        return runner.withInitializer(context -> {
            context.getEnvironment().getPropertySources().remove(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME);
            context.getEnvironment().setActiveProfiles(name);
            new ConfigDataApplicationContextInitializer().initialize(context);
        });
    }
}
