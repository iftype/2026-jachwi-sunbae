package com.jachwisunbae.promotion.collector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.jachwisunbae.promotion.service.PromotionCollectionService;
import com.jachwisunbae.weather.config.WeatherSchedulingConfig;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.annotation.ScheduledAnnotationBeanPostProcessor;

@ExtendWith(OutputCaptureExtension.class)
class PromotionCollectionSchedulerTest {

    private final PromotionCollectionService service = mock(PromotionCollectionService.class);
    private final WebApplicationContextRunner runner = new WebApplicationContextRunner()
            .withUserConfiguration(WeatherSchedulingConfig.class, PromotionCollectionScheduler.class)
            .withBean(PromotionCollectionService.class, () -> service);

    @Test
    @DisplayName("설정이 없으면 스케줄러를 등록하지 않는다")
    void disabledByDefault() {
        runner.run(context -> {
            assertThat(context).doesNotHaveBean(PromotionCollectionScheduler.class);
            assertThat(context.getBean(ScheduledAnnotationBeanPostProcessor.class).getScheduledTasks()).isEmpty();
        });
    }

    @ParameterizedTest
    @CsvSource({"local, false", "dev, true", "prod, true"})
    @DisplayName("dev와 prod에서만 행사상품 자동 수집을 활성화한다")
    void enablesCollectionByProfile(final String profile, final boolean enabled) {
        runner.withInitializer(context -> {
            context.getEnvironment().getPropertySources().remove(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME);
            context.getEnvironment().setActiveProfiles(profile);
            new ConfigDataApplicationContextInitializer().initialize(context);
        }).run(context -> {
            assertThat(context.getEnvironment().getProperty("promotion.collection.enabled", Boolean.class))
                    .isEqualTo(enabled);
            assertThat(context.getBeansOfType(PromotionCollectionScheduler.class)).hasSize(enabled ? 1 : 0);
        });
    }

    @Test
    @DisplayName("활성화하면 정기 수집과 최초 수집 작업을 등록하고 실행 시 Service를 호출한다")
    void enabledTasksCallService() {
        runner.withPropertyValues("promotion.collection.enabled=true").run(context -> {
            var tasks = context.getBean(ScheduledAnnotationBeanPostProcessor.class).getScheduledTasks();
            assertThat(tasks).hasSize(2);

            tasks.forEach(task -> task.getTask().getRunnable().run());

            verify(service).collect();
            verify(service).collectIfEmpty();
        });
    }

    @Test
    @DisplayName("한국시간 기준 매일 오전 4시에 실행한다")
    void schedulesDailyAtFourInKst() throws Exception {
        Scheduled scheduled = PromotionCollectionScheduler.class.getMethod("collect").getAnnotation(Scheduled.class);

        assertThat(scheduled.cron()).isEqualTo("0 0 4 * * *");
        assertThat(scheduled.zone()).isEqualTo("Asia/Seoul");
    }

    @Test
    @DisplayName("최초 수집은 기동 5분 뒤 한 번만 실행한다")
    void collectsOnceFiveMinutesAfterStartup() throws Exception {
        Scheduled scheduled = PromotionCollectionScheduler.class.getMethod("collectInitially")
                .getAnnotation(Scheduled.class);

        assertThat(scheduled.initialDelay()).isEqualTo(5);
        assertThat(scheduled.timeUnit()).isEqualTo(TimeUnit.MINUTES);
        assertThat(scheduled.fixedDelay()).isNegative();
        assertThat(scheduled.fixedRate()).isNegative();
        assertThat(scheduled.cron()).isEmpty();
    }

    @Test
    @DisplayName("수집 예외는 예외 유형만 기록하고 다음 호출을 막지 않는다")
    void recordsFailureAndAllowsNextInvocation(final CapturedOutput output) {
        doThrow(new IllegalStateException("외부 응답 본문")).doNothing().when(service).collect();
        PromotionCollectionScheduler scheduler = new PromotionCollectionScheduler(service);

        scheduler.collect();
        scheduler.collect();

        verify(service, times(2)).collect();
        assertThat(output).contains("promotion-scheduled-collection-failed exceptionType=IllegalStateException")
                .doesNotContain("외부 응답 본문");
    }
}
