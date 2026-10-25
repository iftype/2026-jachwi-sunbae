package com.jachwisunbae.weather.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

import com.jachwisunbae.weather.cleanup.WeatherCleanupScheduler;
import com.jachwisunbae.weather.collector.WeatherCollectionScheduler;
import com.jachwisunbae.weather.notification.scheduler.WeatherNotificationScheduler;
import com.jachwisunbae.weather.notification.service.WeatherNotificationDispatchService;
import com.jachwisunbae.weather.service.WeatherCleanupService;
import com.jachwisunbae.weather.service.WeatherCollectionService;
import java.time.Clock;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;
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
}
