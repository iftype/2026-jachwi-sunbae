package com.jachwisunbae.weather.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.jachwisunbae.weather.collector.WeatherCollectionScheduler;
import com.jachwisunbae.weather.service.WeatherCollectionService;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.annotation.ScheduledAnnotationBeanPostProcessor;

class WeatherSchedulingConfigTest {

    private final WeatherCollectionService service = mock(WeatherCollectionService.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-10-22T17:16:00Z"), ZoneOffset.UTC);
    private final WebApplicationContextRunner web = new WebApplicationContextRunner()
            .withInitializer(new ConfigDataApplicationContextInitializer())
            .withUserConfiguration(WeatherSchedulingConfig.class)
            .withBean(WeatherCollectionService.class, () -> service)
            .withBean(Clock.class, () -> clock);

    @ParameterizedTest
    @ValueSource(strings = {"local", "dev", "prod", "test"})
    @DisplayName("모든 환경에서 기본 OFF이면 스케줄러와 스케줄링 스레드를 등록하지 않는다")
    void defaultsOff(final String profile) {
        web.withPropertyValues("spring.profiles.active=" + profile).run(context -> {
            assertThat(context).hasNotFailed().doesNotHaveBean(WeatherCollectionScheduler.class)
                    .doesNotHaveBean(TaskScheduler.class).doesNotHaveBean(ScheduledAnnotationBeanPostProcessor.class);
            verifyNoInteractions(service);
        });
    }

    @Test
    @DisplayName("서버에서 ON이면 다음 실행 하나를 예약하고 서버 시작 즉시 수집하지 않는다")
    void registersOnlyWhenEnabled() {
        web.withPropertyValues("spring.profiles.active=test", "WEATHER_COLLECTION_ENABLED=true").run(context -> {
            assertThat(context).hasNotFailed().hasSingleBean(WeatherCollectionScheduler.class).hasSingleBean(TaskScheduler.class);
            assertThat(context.getBean(ScheduledAnnotationBeanPostProcessor.class).getScheduledTasks()).hasSize(1);
            assertThat(context.getBean(TaskScheduler.class).getClock()).isSameAs(clock);
            verifyNoInteractions(service);

            context.getBean(WeatherCollectionScheduler.class).collect();

            verify(service).collectAutomatically();
        });
    }

    @Test
    @DisplayName("수동 CLI의 비웹 환경은 자동 수집 설정이 ON이어도 스케줄러를 등록하지 않는다")
    void disablesInNonWebCommand() {
        new ApplicationContextRunner().withUserConfiguration(WeatherSchedulingConfig.class)
                .withPropertyValues("weather.collection.enabled=true")
                .run(context -> assertThat(context).hasNotFailed().doesNotHaveBean(WeatherCollectionScheduler.class)
                        .doesNotHaveBean(TaskScheduler.class).doesNotHaveBean(ScheduledAnnotationBeanPostProcessor.class));
    }
}
