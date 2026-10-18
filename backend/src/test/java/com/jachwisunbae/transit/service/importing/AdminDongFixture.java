package com.jachwisunbae.transit.service.importing;

import com.jachwisunbae.transit.domain.AdminDong;
import com.jachwisunbae.transit.domain.vo.AdminDongBoundary;
import java.time.LocalDate;
import java.util.List;

final class AdminDongFixture {

    // 서울역(37.55, 126.97)을 담는 경도 126.95~126.99, 위도 37.54~37.555 사각형 행정동
    static final AdminDong SEOUL_STATION_DONG = adminDong("11010530", "사직동", 126.95, 126.99, 37.54, 37.555);

    private AdminDongFixture() {
    }

    static AdminDong adminDong(final String code, final String name, final double west, final double east,
                               final double south, final double north) {
        double[] ring = {west, south, east, south, east, north, west, north, west, south};
        return new AdminDong(code, name, "서울특별시", "종로구", "서울특별시 종로구 " + name,
                LocalDate.of(2025, 6, 30), new AdminDongBoundary("{\"type\":\"Polygon\"}", List.of(List.of(ring))));
    }
}
