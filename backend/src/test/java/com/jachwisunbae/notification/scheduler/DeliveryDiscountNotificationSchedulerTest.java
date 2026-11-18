package com.jachwisunbae.notification.scheduler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.jachwisunbae.notification.domain.DeliveryDiscountNotificationType;
import com.jachwisunbae.notification.service.DeliveryDiscountNotificationService;
import java.util.Arrays;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.scheduling.annotation.Scheduled;

class DeliveryDiscountNotificationSchedulerTest {
    private final DeliveryDiscountNotificationService service = mock(DeliveryDiscountNotificationService.class);
    private final DeliveryDiscountNotificationScheduler scheduler = new DeliveryDiscountNotificationScheduler(service);

    static Stream<Arguments> schedules() {
        return Stream.of(
                Arguments.of("baeminFirstCome", "0 0 10 * * *", DeliveryDiscountNotificationType.BAEMIN_FIRST_COME,
                        (Consumer<DeliveryDiscountNotificationScheduler>) DeliveryDiscountNotificationScheduler::baeminFirstCome),
                Arguments.of("closingSoon", "0 0 22 * * *", DeliveryDiscountNotificationType.CLOSING_SOON,
                        (Consumer<DeliveryDiscountNotificationScheduler>) DeliveryDiscountNotificationScheduler::closingSoon));
    }

    @ParameterizedTest(name = "{0}: {1}")
    @MethodSource("schedules")
    @DisplayName("각 유형을 한국 시간 정해진 시각에 실행하고 해당 유형으로 발송한다")
    void runsEachTypeAtKstSchedule(final String method, final String cron, final DeliveryDiscountNotificationType type,
                                   final Consumer<DeliveryDiscountNotificationScheduler> run) throws Exception {
        Scheduled scheduled = DeliveryDiscountNotificationScheduler.class.getMethod(method).getAnnotation(Scheduled.class);
        assertThat(scheduled.cron()).isEqualTo(cron);
        assertThat(scheduled.zone()).isEqualTo("Asia/Seoul");

        run.accept(scheduler);

        verify(service).dispatch(type);
    }

    @Test
    @DisplayName("배달 할인 알림은 하루 10시와 22시 두 번만 실행한다")
    void runsOnlyAtTenAndTwentyTwo() {
        assertThat(Arrays.stream(DeliveryDiscountNotificationScheduler.class.getDeclaredMethods())
                .map(method -> method.getAnnotation(Scheduled.class))
                .filter(Objects::nonNull)
                .map(Scheduled::cron))
                .containsExactlyInAnyOrder("0 0 10 * * *", "0 0 22 * * *");
    }

    @Test
    @DisplayName("스케줄러는 delivery-discount.notification.enabled=true일 때만 등록되고, 설정이 없거나 false면 등록되지 않는다")
    void registeredOnlyWhenEnabled() {
        ApplicationContextRunner runner = new ApplicationContextRunner()
                .withBean(DeliveryDiscountNotificationService.class, () -> service)
                .withUserConfiguration(DeliveryDiscountNotificationScheduler.class);

        runner.run(context -> assertThat(context).doesNotHaveBean(DeliveryDiscountNotificationScheduler.class));
        runner.withPropertyValues("delivery-discount.notification.enabled=false")
                .run(context -> assertThat(context).doesNotHaveBean(DeliveryDiscountNotificationScheduler.class));
        runner.withPropertyValues("delivery-discount.notification.enabled=true")
                .run(context -> assertThat(context).hasSingleBean(DeliveryDiscountNotificationScheduler.class));
    }

    @ParameterizedTest
    @ValueSource(strings = {"local", "dev", "prod"})
    @DisplayName("모든 환경 설정에서 배달 할인 스케줄러가 켜져 있다")
    void enabledInEveryProfile(final String profile) {
        new ApplicationContextRunner()
                .withBean(DeliveryDiscountNotificationService.class, () -> service)
                .withUserConfiguration(DeliveryDiscountNotificationScheduler.class)
                .withInitializer(context -> {
                    context.getEnvironment().getPropertySources()
                            .remove(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME);
                    context.getEnvironment().setActiveProfiles(profile);
                    new ConfigDataApplicationContextInitializer().initialize(context);
                })
                .run(context -> {
                    assertThat(context.getEnvironment().getProperty("delivery-discount.notification.enabled"))
                            .isEqualTo("true");
                    assertThat(context).hasSingleBean(DeliveryDiscountNotificationScheduler.class);
                });
    }
}
