package com.jachwisunbae.transit.domain.collection;

import static org.assertj.core.api.Assertions.assertThat;

import com.jachwisunbae.transit.domain.AdminDong;
import com.jachwisunbae.transit.domain.vo.AdminDongBoundary;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AdminDongLocatorTest {

    private static final AdminDong WEST = adminDong("11010530", 127.00, 127.10);
    private static final AdminDong EAST = adminDong("11010540", 127.10, 127.30);

    private final AdminDongLocator locator = new AdminDongLocator(List.of(WEST, EAST));

    @Test
    @DisplayName("좌표가 들어 있는 행정동을 찾는다")
    void locatesContainingAdminDong() {
        assertThat(locator.locate(new Coordinate(37.55, 127.05))).contains(WEST);
        assertThat(locator.locate(new Coordinate(37.55, 127.25))).contains(EAST);
    }

    @Test
    @DisplayName("어느 행정동에도 들지 않으면 찾지 못한다")
    void returnsEmptyOutsideAllAdminDongs() {
        assertThat(locator.locate(new Coordinate(37.70, 127.05))).isEmpty();
        assertThat(locator.locate(new Coordinate(33.50, 126.50))).isEmpty();
    }

    private static AdminDong adminDong(final String code, final double west, final double east) {
        double[] ring = {west, 37.50, east, 37.50, east, 37.60, west, 37.60, west, 37.50};
        return new AdminDong(code, "동" + code, "서울특별시", "종로구", "서울특별시 종로구 동" + code,
                LocalDate.of(2025, 6, 30), new AdminDongBoundary("{\"type\":\"Polygon\"}", List.of(List.of(ring))));
    }
}
