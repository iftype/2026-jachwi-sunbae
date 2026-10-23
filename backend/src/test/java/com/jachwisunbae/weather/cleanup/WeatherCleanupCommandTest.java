package com.jachwisunbae.weather.cleanup;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.jachwisunbae.weather.service.WeatherCleanupService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class WeatherCleanupCommandTest {

    @Test
    @DisplayName("수동 정리는 공통 서비스를 한 번 호출하고 설정 OFF·DB 실패는 명령 실패로 전파한다")
    void executesServiceAndPropagatesFailure() {
        WeatherCleanupService service = mock(WeatherCleanupService.class);
        WeatherCleanupCommand.execute(service);
        verify(service).cleanup();

        IllegalStateException failure = new IllegalStateException("disabled or failed");
        when(service.cleanup()).thenThrow(failure);
        assertThatThrownBy(() -> WeatherCleanupCommand.execute(service)).isSameAs(failure);
    }

    @ParameterizedTest
    @ValueSource(strings = {"--before=20990101", "--published-at=2026102302", "--initialize", "20261023"})
    @DisplayName("임의 기준일과 미지원 인자는 DB 연결 전에 거부한다")
    void rejectsArguments(final String argument) {
        assertThatThrownBy(() -> WeatherCleanupCommand.main(new String[]{argument}))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
