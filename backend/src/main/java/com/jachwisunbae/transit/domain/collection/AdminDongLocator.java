package com.jachwisunbae.transit.domain.collection;

import com.jachwisunbae.transit.domain.AdminDong;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.vo.AdminDongBoundary;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

// 좌표가 속한 행정동을 찾는다. 전국 행정동을 매번 모두 검사하지 않도록 경계 상자를 격자에 미리 나눠 담는다.
// 경계선 위의 점처럼 두 행정동에 걸치면 먼저 받은 행정동을 고른다.
public class AdminDongLocator {

    // 0.05도는 위도 기준 약 5.5km로, 행정동 하나가 격자 몇 칸에 걸치는 크기다.
    private static final double CELL_DEGREES = 0.05;

    private final Map<Long, List<AdminDong>> adminDongsByCell = new HashMap<>();

    public AdminDongLocator(final List<AdminDong> adminDongs) {
        adminDongs.forEach(this::index);
    }

    public Optional<AdminDong> locate(final Coordinate coordinate) {
        long cell = cell(row(coordinate.latitude()), column(coordinate.longitude()));
        return adminDongsByCell.getOrDefault(cell, List.of()).stream()
                .filter(adminDong -> adminDong.contains(coordinate))
                .findFirst();
    }

    // 정류장마다 속한 행정동 코드를 붙인다. 어느 행정동에도 들지 않으면 코드를 비운다.
    public List<GtfsStop> assignTo(final List<GtfsStop> stops) {
        return stops.stream()
                .map(stop -> stop.withAdminDongCode(locate(stop.coordinate()).map(AdminDong::code).orElse(null)))
                .toList();
    }

    private void index(final AdminDong adminDong) {
        AdminDongBoundary boundary = adminDong.boundary();
        for (int row = row(boundary.minLatitude()); row <= row(boundary.maxLatitude()); row++) {
            for (int column = column(boundary.minLongitude()); column <= column(boundary.maxLongitude()); column++) {
                adminDongsByCell.computeIfAbsent(cell(row, column), ignored -> new ArrayList<>()).add(adminDong);
            }
        }
    }

    private static int row(final double latitude) {
        return (int) Math.floor(latitude / CELL_DEGREES);
    }

    private static int column(final double longitude) {
        return (int) Math.floor(longitude / CELL_DEGREES);
    }

    private static long cell(final int row, final int column) {
        return ((long) row << 32) | (column & 0xffffffffL);
    }
}
