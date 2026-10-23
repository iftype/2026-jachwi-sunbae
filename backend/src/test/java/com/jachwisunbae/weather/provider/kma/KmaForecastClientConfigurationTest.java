package com.jachwisunbae.weather.provider.kma;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class KmaForecastClientConfigurationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(KmaForecastClient.class);

    @Test
    @DisplayName("인증키가 없어도 클라이언트를 등록하고 기동한다")
    void startsWithoutApiKey() {
        contextRunner.withPropertyValues("weather.kma.api-key=")
                .run(context -> assertThat(context).hasNotFailed().hasSingleBean(KmaForecastClient.class));
    }

    @Test
    @DisplayName("인증키 환경변수를 설정한 애플리케이션도 기동한다")
    void startsWithApiKeyEnvironmentSetting() {
        contextRunner.withInitializer(new ConfigDataApplicationContextInitializer())
                .withPropertyValues("spring.profiles.active=test", "KMA_API_KEY=test-key")
                .run(context -> assertThat(context).hasNotFailed().hasSingleBean(KmaForecastClient.class));
    }
}
