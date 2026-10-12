package com.jachwisunbae.map.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class BusStopTest {

    private static final BigDecimal LATITUDE = new BigDecimal("37.4064167");
    private static final BigDecimal LONGITUDE = new BigDecimal("127.0882833");

    @Test
    @DisplayName("정류장 ID, 이름, 좌표, 도시 코드로 복원한다")
    void reconstructs() {
        BusStop busStop = BusStop.reconstruct("GGB204000159", "벤처타운(북문)", LATITUDE, LONGITUDE, "31020");

        assertThat(busStop.getNodeId()).isEqualTo("GGB204000159");
        assertThat(busStop.getCityCode()).isEqualTo("31020");
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = " ")
    @DisplayName("정류장 ID, 이름, 도시 코드가 없으면 복원할 수 없다")
    void requiresText(String value) {
        assertThatThrownBy(() -> BusStop.reconstruct(value, "벤처타운(북문)", LATITUDE, LONGITUDE, "31020"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> BusStop.reconstruct("GGB204000159", value, LATITUDE, LONGITUDE, "31020"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> BusStop.reconstruct("GGB204000159", "벤처타운(북문)", LATITUDE, LONGITUDE, value))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("좌표가 없거나 범위를 벗어나면 복원할 수 없다")
    void requiresValidCoordinate() {
        assertThatThrownBy(() -> BusStop.reconstruct("GGB204000159", "벤처타운(북문)", null, LONGITUDE, "31020"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> BusStop.reconstruct("GGB204000159", "벤처타운(북문)", new BigDecimal("90.0000001"),
                LONGITUDE, "31020"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> BusStop.reconstruct("GGB204000159", "벤처타운(북문)", LATITUDE,
                new BigDecimal("-180.0000001"), "31020"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
