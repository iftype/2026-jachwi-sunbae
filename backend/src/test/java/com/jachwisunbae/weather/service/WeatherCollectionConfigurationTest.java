package com.jachwisunbae.weather.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.jachwisunbae.weather.provider.kma.KmaForecastClient;
import com.jachwisunbae.weather.provider.kma.KmaForecastRequest;
import com.jachwisunbae.weather.repository.JdbcWeatherForecastRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.transaction.PlatformTransactionManager;

class WeatherCollectionConfigurationTest {

    private final KmaForecastClient client = mock(KmaForecastClient.class);
    private final JdbcWeatherForecastRepository repository = mock(JdbcWeatherForecastRepository.class);
    private final PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withInitializer(new ConfigDataApplicationContextInitializer())
            .withUserConfiguration(WeatherCollectionService.class)
            .withBean(KmaForecastClient.class, () -> client)
            .withBean(JdbcWeatherForecastRepository.class, () -> repository)
            .withBean(PlatformTransactionManager.class, () -> transactions)
            .withBean(Clock.class, () -> Clock.fixed(Instant.parse("2026-10-22T17:20:00Z"), ZoneOffset.UTC));

    @ParameterizedTest
    @ValueSource(strings = {"local", "dev", "prod", "test"})
    @DisplayName("모든 환경에서 초기 적재·자동 수집·정리는 기본 OFF이며 기동만으로 실행하지 않는다")
    void defaultsOffInEveryProfile(final String profile) {
        contextRunner.withPropertyValues("spring.profiles.active=" + profile).run(context -> {
            assertThat(context).hasNotFailed();
            for (String feature : new String[]{"initial-load", "collection", "cleanup"}) {
                assertThat(context.getEnvironment().getProperty("weather." + feature + ".enabled", Boolean.class))
                        .isFalse();
            }
            assertThatThrownBy(() -> context.getBean(WeatherCollectionService.class).initializeIfEmpty())
                    .isInstanceOf(IllegalStateException.class);
            verifyNoInteractions(repository, client, transactions);
        });
    }

    @Test
    @DisplayName("자동 수집·정리 설정을 켜도 초기 적재 설정은 독립적으로 OFF를 유지한다")
    void keepsFeatureSwitchesIndependent() {
        contextRunner.withPropertyValues("spring.profiles.active=test", "WEATHER_COLLECTION_ENABLED=true",
                "WEATHER_CLEANUP_ENABLED=true").run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context.getEnvironment().getProperty("weather.collection.enabled", Boolean.class)).isTrue();
                    assertThat(context.getEnvironment().getProperty("weather.cleanup.enabled", Boolean.class)).isTrue();
                    assertThatThrownBy(() -> context.getBean(WeatherCollectionService.class).initializeIfEmpty())
                            .isInstanceOf(IllegalStateException.class);
                    verifyNoInteractions(repository, client, transactions);
                });
    }

    @Test
    @DisplayName("초기 적재 설정과 공개 대기시간을 환경변수로 주입해 명시적 호출에 적용한다")
    void bindsInitializationAndDelay() {
        IllegalStateException failure = new IllegalStateException("stop before HTTP");
        when(client.fetchMeasured(any())).thenAnswer(invocation -> {
            KmaForecastRequest request = invocation.getArgument(0);
            assertThat(request.times().publishedAt()).isEqualTo(LocalDateTime.of(2026, 10, 22, 23, 0));
            throw failure;
        });
        contextRunner.withPropertyValues("spring.profiles.active=test", "WEATHER_INITIAL_LOAD_ENABLED=true",
                "WEATHER_PUBLICATION_DELAY_MINUTES=30").run(context -> {
                    assertThat(context).hasNotFailed();
                    verifyNoInteractions(repository, client, transactions);
                    assertThat(context.getEnvironment().getProperty("weather.collection.enabled", Boolean.class)).isFalse();
                    assertThat(context.getEnvironment().getProperty("weather.cleanup.enabled", Boolean.class)).isFalse();
                    assertThatThrownBy(() -> context.getBean(WeatherCollectionService.class).initializeIfEmpty())
                            .isSameAs(failure);
                });
    }

    @Test
    @DisplayName("음수 공개 대기시간 설정은 기동 시 거부한다")
    void rejectsNegativeDelay() {
        contextRunner.withPropertyValues("spring.profiles.active=test", "WEATHER_PUBLICATION_DELAY_MINUTES=-1")
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure()).hasRootCauseInstanceOf(IllegalArgumentException.class);
                    verifyNoInteractions(repository, client, transactions);
                });
    }
}
