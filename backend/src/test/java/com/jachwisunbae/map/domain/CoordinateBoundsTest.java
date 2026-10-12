package com.jachwisunbae.map.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class CoordinateBoundsTest {

    private static final BigDecimal LATITUDE = new BigDecimal("37.3948");
    private static final BigDecimal LONGITUDE = new BigDecimal("127.1112");

    @Test
    @DisplayName("최솟값과 최댓값이 같은 한 점도 범위로 만들 수 있다")
    void allowsSinglePoint() {
        assertThatCode(() -> CoordinateBounds.of(LATITUDE, LATITUDE, LONGITUDE, LONGITUDE))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("최솟값이 최댓값보다 크면 만들 수 없다")
    void rejectsReversedRange() {
        BigDecimal larger = new BigDecimal("37.4");

        assertThatThrownBy(() -> CoordinateBounds.of(larger, LATITUDE, LONGITUDE, LONGITUDE))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> CoordinateBounds.of(LATITUDE, LATITUDE, new BigDecimal("127.2"), LONGITUDE))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("범위 값이 없으면 만들 수 없다")
    void requiresAllValues() {
        assertThatThrownBy(() -> CoordinateBounds.of(null, LATITUDE, LONGITUDE, LONGITUDE))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> CoordinateBounds.of(LATITUDE, LATITUDE, LONGITUDE, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @ValueSource(ints = {500, 1000, 2000})
    @DisplayName("반경으로 만든 사각형은 중심에서 동서남북으로 반경 거리의 지점까지 덮는다")
    void coversCircleAroundCenter(int radius) {
        CoordinateBounds bounds = CoordinateBounds.around(LATITUDE, LONGITUDE, radius);

        assertThat(GeoDistance.meters(LATITUDE, LONGITUDE, bounds.getMaxLatitude(), LONGITUDE))
                .isGreaterThanOrEqualTo(radius);
        assertThat(GeoDistance.meters(LATITUDE, LONGITUDE, bounds.getMinLatitude(), LONGITUDE))
                .isGreaterThanOrEqualTo(radius);
        assertThat(GeoDistance.meters(LATITUDE, LONGITUDE, LATITUDE, bounds.getMaxLongitude()))
                .isGreaterThanOrEqualTo(radius);
        assertThat(GeoDistance.meters(LATITUDE, LONGITUDE, LATITUDE, bounds.getMinLongitude()))
                .isGreaterThanOrEqualTo(radius);
    }

    @Test
    @DisplayName("위도 폭은 위도와 관계없고 경도 폭은 위도가 높을수록 넓어진다")
    void widensLongitudeRangeAtHigherLatitude() {
        CoordinateBounds equator = CoordinateBounds.around(BigDecimal.ZERO, BigDecimal.ZERO, 2000);
        CoordinateBounds sixtyDegrees = CoordinateBounds.around(new BigDecimal("60"), BigDecimal.ZERO, 2000);

        assertThat(height(sixtyDegrees)).isEqualByComparingTo(height(equator));
        assertThat(width(sixtyDegrees).doubleValue())
                .isCloseTo(width(equator).doubleValue() * 2, within(0.000001));
    }

    @Test
    @DisplayName("극에 가까워 좌표 범위를 넘으면 경계에서 자른다")
    void clampsRangeNearPole() {
        CoordinateBounds bounds = CoordinateBounds.around(new BigDecimal("89.9999"), BigDecimal.ZERO, 2000);

        assertThat(bounds.getMaxLatitude()).isEqualByComparingTo("90");
        assertThat(bounds.getMinLongitude()).isEqualByComparingTo("-180");
        assertThat(bounds.getMaxLongitude()).isEqualByComparingTo("180");
    }

    @ParameterizedTest
    @ValueSource(ints = {0, -1})
    @DisplayName("반경이 양수가 아니면 만들 수 없다")
    void requiresPositiveRadius(int radius) {
        assertThatThrownBy(() -> CoordinateBounds.around(LATITUDE, LONGITUDE, radius))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private BigDecimal height(CoordinateBounds bounds) {
        return bounds.getMaxLatitude().subtract(bounds.getMinLatitude());
    }

    private BigDecimal width(CoordinateBounds bounds) {
        return bounds.getMaxLongitude().subtract(bounds.getMinLongitude());
    }
}
