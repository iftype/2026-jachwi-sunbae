package com.jachwisunbae.weather.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

class GridForecastTest {

    @ParameterizedTest
    @CsvSource({"0, 1, 1", "148, 149, 1", "149, 1, 2", "18833, 60, 127", "37696, 149, 253"})
    @DisplayName("원본 배열 인덱스를 1부터 시작하는 격자 좌표로 변환한다")
    void mapsRowBoundaries(final int index, final int nx, final int ny) {
        assertThat(GridPoint.fromIndex(index)).isEqualTo(new GridPoint(nx, ny));
    }

    @ParameterizedTest
    @CsvSource({"0, 1", "1, 0", "150, 1", "1, 254"})
    @DisplayName("격자 범위를 벗어난 좌표를 거부한다")
    void rejectsOutOfBoundsCoordinates(final int nx, final int ny) {
        assertThatThrownBy(() -> new GridPoint(nx, ny)).isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @ValueSource(ints = {-1, 37697})
    @DisplayName("격자 범위를 벗어난 원본 인덱스를 거부한다")
    void rejectsOutOfBoundsIndices(final int index) {
        assertThatThrownBy(() -> GridPoint.fromIndex(index)).isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @ValueSource(doubles = {-99, -999, Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY})
    @DisplayName("결측 마커나 유한하지 않은 값을 유효 격자 값으로 만들 수 없다")
    void rejectsMissingAndNonFiniteValues(final double value) {
        assertThatThrownBy(() -> new GridValue(new GridPoint(1, 1), value))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("외부에서 원본 목록을 바꾸어도 예보 값과 개수는 유지된다")
    void protectsParsedValues() {
        GridValue value = new GridValue(new GridPoint(60, 127), 14);
        List<GridValue> values = new ArrayList<>(List.of(value));
        GridForecast forecast = new GridForecast(ForecastTimes.parse("2026102214", "2026102217"),
                WeatherElement.TMP, values);

        values.clear();

        assertThat(forecast.values()).containsExactly(value);
        assertThat(forecast.validCount()).isEqualTo(1);
        assertThat(forecast.missingCount()).isEqualTo(37696);
        assertThatThrownBy(() -> forecast.values().clear()).isInstanceOf(UnsupportedOperationException.class);
    }
}
