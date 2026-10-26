package com.jachwisunbae.weather.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

class GridPointTest {

    @ParameterizedTest
    @CsvSource({"0, 1, 1", "148, 149, 1", "149, 1, 2", "18833, 60, 127", "37696, 149, 253"})
    @DisplayName("원본 배열 인덱스를 1부터 시작하는 격자 좌표로 변환한다")
    void mapsRowBoundaries(final int index, final int nx, final int ny) {
        assertThat(GridPoint.fromIndex(index)).isEqualTo(new GridPoint(nx, ny));
        assertThat(new GridPoint(nx, ny).toIndex()).isEqualTo(index);
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
}
