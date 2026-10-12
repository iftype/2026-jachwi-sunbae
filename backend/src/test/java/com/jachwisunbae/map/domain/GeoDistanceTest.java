package com.jachwisunbae.map.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class GeoDistanceTest {

    private static final BigDecimal LATITUDE = new BigDecimal("37.3948");
    private static final BigDecimal LONGITUDE = new BigDecimal("127.1112");

    @Test
    @DisplayName("같은 좌표 사이의 거리는 0이다")
    void returnsZeroForSamePoint() {
        assertThat(GeoDistance.meters(LATITUDE, LONGITUDE, LATITUDE, LONGITUDE)).isZero();
    }

    @Test
    @DisplayName("위도 1도는 약 111,195m다")
    void calculatesOneLatitudeDegree() {
        double distance = GeoDistance.meters(new BigDecimal("37"), LONGITUDE, new BigDecimal("38"), LONGITUDE);

        assertThat(distance).isCloseTo(111_195, within(1.0));
    }

    @Test
    @DisplayName("같은 경도 차이라도 위도가 높을수록 거리가 짧다")
    void shortensLongitudeDistanceAtHigherLatitude() {
        double equator = GeoDistance.meters(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ONE);
        double sixtyDegrees = GeoDistance.meters(new BigDecimal("60"), BigDecimal.ZERO,
                new BigDecimal("60"), BigDecimal.ONE);

        assertThat(sixtyDegrees).isCloseTo(equator / 2, within(100.0));
    }
}
