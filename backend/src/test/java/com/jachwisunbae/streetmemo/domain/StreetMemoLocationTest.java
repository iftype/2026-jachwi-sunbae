package com.jachwisunbae.streetmemo.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class StreetMemoLocationTest {

    @ParameterizedTest
    @CsvSource({"-90, -180", "90, 180"})
    @DisplayName("위도·경도의 최솟값과 최댓값을 포함한다")
    void acceptsCoordinateBoundaries(BigDecimal latitude, BigDecimal longitude) {
        StreetMemoLocation location = new StreetMemoLocation(latitude, longitude);

        assertThat(location.latitude()).isEqualTo(latitude);
        assertThat(location.longitude()).isEqualTo(longitude);
    }
}
