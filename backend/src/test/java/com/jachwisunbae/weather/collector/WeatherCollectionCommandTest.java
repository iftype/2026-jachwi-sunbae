package com.jachwisunbae.weather.collector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;

import com.jachwisunbae.weather.service.WeatherCollectionService;
import java.time.LocalDateTime;
import java.util.TimeZone;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

class WeatherCollectionCommandTest {

    @Test
    @DisplayName("명시한 발표분과 최초 적재 옵션을 같은 수집 서비스로 전달한다")
    void dispatchesToSharedService() {
        WeatherCollectionService service = mock(WeatherCollectionService.class);
        WeatherCollectionCommand.execute(WeatherCollectionCommand.parseArguments(
                new String[]{"--published-at=2026102302"}), service);
        WeatherCollectionCommand.execute(WeatherCollectionCommand.parseArguments(new String[]{"--initialize"}), service);

        verify(service).collect(LocalDateTime.of(2026, 10, 23, 2, 0));
        verify(service).initializeIfEmpty();
        verifyNoMoreInteractions(service);
    }

    @ParameterizedTest
    @ValueSource(strings = {"--initialize=true", "--initialize=false", "--initialize=", "--initialize --initialize",
            "--initialize --published-at=2026102302", "--initialize --unknown=true", "--initialize extra"})
    @DisplayName("최초 적재 옵션의 값·중복·다른 모드와의 혼용을 기동 전에 거부한다")
    void rejectsInvalidInitializationOptions(final String input) {
        assertThatThrownBy(() -> WeatherCollectionCommand.main(input.split(" ")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @CsvSource({"2026102302, 2", "2026102323, 23"})
    @DisplayName("KST 발표시각을 명시한 단일 실행 인자를 해석한다")
    void parsesExplicitPublication(final String input, final int hour) {
        assertThat(WeatherCollectionCommand.parseArguments(new String[]{"--published-at=" + input}).publishedAt())
                .isEqualTo(LocalDateTime.of(2026, 10, 23, hour, 0));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "--published-at", "--published-at=", "--published-at=2026023002",
            "--published-at=2026102303", "--published-at=2026-10-23T02:00", "--published-at=2026102302 --unknown=true",
            "--published-at=2026102302 --published-at=2026102305", "--published-at=2026102302 --published-at",
            "2026102302"})
    @DisplayName("누락·잘못된 날짜·미지원 옵션은 DB·HTTP 실행 전에 거부한다")
    void rejectsInvalidArguments(final String input) {
        assertThatThrownBy(() -> WeatherCollectionCommand.main(input.isEmpty() ? new String[0] : input.split(" ")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"2026023002", "2026022902", "2026102224", "2026132202", "202610220200",
            "20261022", "abcdefghij", "2026102202Z", "2026102202 ", "２０２６１０２２０２"})
    @DisplayName("CLI 경계에서 잘못된 날짜·길이·형식을 엄격하게 거부한다")
    void rejectsInvalidPublicationValue(final String value) {
        assertThatThrownBy(() -> WeatherCollectionCommand.parseArguments(new String[]{"--published-at=" + value}))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"UTC", "America/Los_Angeles"})
    @ResourceLock("default-time-zone")
    @DisplayName("CLI의 윤년 날짜를 JVM 시간대와 무관하게 KST 시각으로 해석한다")
    void parsesLeapDayWithoutTimeZoneConversion(final String zone) {
        TimeZone previous = TimeZone.getDefault();
        try {
            TimeZone.setDefault(TimeZone.getTimeZone(zone));
            assertThat(WeatherCollectionCommand.parseArguments(new String[]{"--published-at=2028022923"}).publishedAt())
                    .isEqualTo(LocalDateTime.of(2028, 2, 29, 23, 0));
        } finally {
            TimeZone.setDefault(previous);
        }
    }
}
