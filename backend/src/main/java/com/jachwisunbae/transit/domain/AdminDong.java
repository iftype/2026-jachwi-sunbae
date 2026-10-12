package com.jachwisunbae.transit.domain;

import com.jachwisunbae.transit.domain.vo.AdminDongBoundary;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import java.time.LocalDate;

// 통계청 SGIS 행정동 경계의 한 행정동이다. 코드는 통계청 행정동 코드(8자리)다.
public record AdminDong(String code, String name, String sidoName, String sigunguName, String fullName,
                        LocalDate baseDate, AdminDongBoundary boundary) {

    public AdminDong {
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException("행정동 코드가 필요합니다.");
        }
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("행정동 이름이 필요합니다. code=" + code);
        }
    }

    public Coordinate center() {
        return boundary.center();
    }

    public boolean contains(final Coordinate coordinate) {
        return boundary.contains(coordinate);
    }
}
