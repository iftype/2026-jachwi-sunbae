package com.jachwisunbae.transit.domain.vo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class CoordinateTest {

    @Test
    @DisplayName("위도·경도 범위의 경계값으로 만들 수 있다")
    void acceptsBoundaries() {
        assertThatCode(() -> new Coordinate(90, 180)).doesNotThrowAnyException();
        assertThatCode(() -> new Coordinate(-90, -180)).doesNotThrowAnyException();
    }

    @ParameterizedTest
    @CsvSource({"90.1, 127", "-90.1, 127", "37.5, 180.1", "37.5, -180.1", "NaN, 127", "37.5, NaN"})
    @DisplayName("위도·경도 범위를 벗어나거나 숫자가 아니면 만들 수 없다")
    void rejectsOutOfRange(final double latitude, final double longitude) {
        assertThatThrownBy(() -> new Coordinate(latitude, longitude))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("두 좌표 사이의 지표면 거리를 미터로 구한다")
    void measuresMeters() {
        Coordinate seoulStation = new Coordinate(37.5547, 126.9707);
        Coordinate cityHall = new Coordinate(37.5663, 126.9779);

        assertThat(seoulStation.metersTo(cityHall)).isCloseTo(1437.5, within(1.0));
        assertThat(seoulStation.metersTo(seoulStation)).isZero();
    }
}
