package com.jachwisunbae.weather.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class ForecastTimesTest {

    @Test
    @DisplayName("날짜를 넘는 KST 발표·예보 시각을 변환 없이 보관한다")
    void preservesKstTimesAcrossDateBoundary() {
        ForecastTimes times = new ForecastTimes(LocalDateTime.of(2026, 10, 22, 23, 0),
                LocalDateTime.of(2026, 10, 23, 0, 0));

        assertThat(times.publishedAt()).isEqualTo(LocalDateTime.of(2026, 10, 22, 23, 0));
        assertThat(times.forecastAt()).isEqualTo(LocalDateTime.of(2026, 10, 23, 0, 0));
    }

    @Test
    @DisplayName("발표시각이나 예보대상시각의 누락을 거부한다")
    void rejectsMissingTimes() {
        LocalDateTime time = LocalDateTime.of(2026, 10, 22, 17, 0);
        assertThatThrownBy(() -> new ForecastTimes(null, time))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ForecastTimes(time, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("발표시각과 같은 정시의 예보대상시각을 허용한다")
    void acceptsForecastAtPublication() {
        LocalDateTime time = LocalDateTime.of(2026, 10, 22, 17, 0);
        assertThat(new ForecastTimes(time, time).forecastAt()).isEqualTo(time);
    }

    @Test
    @DisplayName("발표보다 이전인 예보 시각을 거부한다")
    void rejectsForecastBeforePublication() {
        LocalDateTime publication = LocalDateTime.of(2026, 10, 22, 14, 0);
        assertThatThrownBy(() -> new ForecastTimes(publication, publication.minusHours(3)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @ValueSource(longs = {1, 1000000000, 60000000000L})
    @DisplayName("발표·예보 시각의 분·초·나노초를 자동 보정하지 않고 거부한다")
    void rejectsSubHourTimes(final long nanos) {
        LocalDateTime publishedAt = LocalDateTime.of(2026, 10, 22, 14, 0);
        LocalDateTime forecastAt = publishedAt.plusHours(3);

        assertThatThrownBy(() -> new ForecastTimes(publishedAt.plusNanos(nanos), forecastAt))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ForecastTimes(publishedAt, forecastAt.plusNanos(nanos)))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
