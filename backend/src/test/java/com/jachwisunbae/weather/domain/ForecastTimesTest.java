package com.jachwisunbae.weather.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class ForecastTimesTest {

    @Test
    @DisplayName("날짜를 넘는 KST 발표·예보 시각을 변환 없이 보관한다")
    void preservesKstTimesAcrossDateBoundary() {
        ForecastTimes times = ForecastTimes.parse("2026102223", "2026102300");

        assertThat(times.publishedAt()).isEqualTo(LocalDateTime.of(2026, 10, 22, 23, 0));
        assertThat(times.forecastAt()).isEqualTo(LocalDateTime.of(2026, 10, 23, 0, 0));
        assertThat(times.tmfc()).isEqualTo("2026102223");
        assertThat(times.tmef()).isEqualTo("2026102300");
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"2026023014", "2026102224", "2026132214", "202610221400", "20261022", "abcdefghij"})
    @DisplayName("실재하지 않는 날짜나 잘못된 형식의 발표·예보 시각을 거부한다")
    void rejectsInvalidTimestamps(final String invalid) {
        assertThatThrownBy(() -> ForecastTimes.parse(invalid, "2026102217"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> ForecastTimes.parse("2026102214", invalid))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("발표보다 이전인 예보 시각을 거부한다")
    void rejectsForecastBeforePublication() {
        assertThatThrownBy(() -> ForecastTimes.parse("2026102214", "2026102211"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("직접 생성해도 요청 문자열에서 분·초가 유실되는 시각을 거부한다")
    void rejectsSubHourTimes() {
        LocalDateTime publishedAt = LocalDateTime.of(2026, 10, 22, 14, 0);
        LocalDateTime forecastAt = publishedAt.plusHours(3);

        assertThatThrownBy(() -> new ForecastTimes(publishedAt.plusMinutes(1), forecastAt))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ForecastTimes(publishedAt, forecastAt.plusSeconds(1)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ForecastTimes(publishedAt, forecastAt.plusNanos(1)))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
