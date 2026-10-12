package com.jachwisunbae.transit.domain.vo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AdminDongBoundaryTest {

    // 경도 127.00~127.10, 위도 37.50~37.60 사각형
    private static final double[] SQUARE = {127.00, 37.50, 127.10, 37.50, 127.10, 37.60, 127.00, 37.60, 127.00, 37.50};
    // 가운데 127.04~127.06, 37.54~37.56 구멍
    private static final double[] HOLE = {127.04, 37.54, 127.06, 37.54, 127.06, 37.56, 127.04, 37.56, 127.04, 37.54};
    // 동쪽으로 떨어진 두 번째 사각형 127.20~127.24, 37.50~37.54
    private static final double[] ISLAND = {127.20, 37.50, 127.24, 37.50, 127.24, 37.54, 127.20, 37.54, 127.20, 37.50};

    @Test
    @DisplayName("바깥 고리 안의 점은 포함하고 밖의 점은 포함하지 않는다")
    void containsPointInsideOuterRing() {
        AdminDongBoundary boundary = boundary(List.of(List.of(SQUARE)));

        assertThat(boundary.contains(new Coordinate(37.52, 127.02))).isTrue();
        assertThat(boundary.contains(new Coordinate(37.62, 127.02))).isFalse();
        assertThat(boundary.contains(new Coordinate(37.52, 127.12))).isFalse();
    }

    @Test
    @DisplayName("구멍 안의 점은 포함하지 않는다")
    void excludesPointInsideHole() {
        AdminDongBoundary boundary = boundary(List.of(List.of(SQUARE, HOLE)));

        assertThat(boundary.contains(new Coordinate(37.55, 127.05))).isFalse();
        assertThat(boundary.contains(new Coordinate(37.52, 127.02))).isTrue();
    }

    @Test
    @DisplayName("여러 폴리곤 중 하나에라도 들어 있으면 포함한다")
    void containsPointInAnyPolygon() {
        AdminDongBoundary boundary = boundary(List.of(List.of(SQUARE), List.of(ISLAND)));

        assertThat(boundary.contains(new Coordinate(37.52, 127.22))).isTrue();
        assertThat(boundary.contains(new Coordinate(37.52, 127.15))).isFalse();
    }

    @Test
    @DisplayName("중심은 가장 넓은 폴리곤 바깥 고리의 무게중심이다")
    void centerIsCentroidOfLargestPolygon() {
        Coordinate center = boundary(List.of(List.of(ISLAND), List.of(SQUARE))).center();

        assertThat(center.latitude()).isCloseTo(37.55, within(1e-9));
        assertThat(center.longitude()).isCloseTo(127.05, within(1e-9));
    }

    @Test
    @DisplayName("꼭짓점이 3개 미만인 고리나 빈 경계는 만들 수 없다")
    void rejectsInvalidRings() {
        assertThatThrownBy(() -> boundary(List.of()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> boundary(List.of(List.of(new double[]{127.0, 37.5, 127.1, 37.5}))))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private AdminDongBoundary boundary(final List<List<double[]>> polygons) {
        return new AdminDongBoundary("{\"type\":\"Polygon\"}", polygons);
    }
}
