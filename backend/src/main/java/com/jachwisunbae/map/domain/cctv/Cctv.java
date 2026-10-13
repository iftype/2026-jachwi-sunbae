package com.jachwisunbae.map.domain.cctv;

import com.jachwisunbae.map.domain.GeoDistance;
import java.math.BigDecimal;
import lombok.Getter;

// 전국CCTV표준데이터의 공공 CCTV. 화소수(만 화소 단위)와 보관일수는 원본에 없거나 애매하면 null이다.
@Getter
public class Cctv {

    private static final BigDecimal MAX_LATITUDE = BigDecimal.valueOf(90);
    private static final BigDecimal MAX_LONGITUDE = BigDecimal.valueOf(180);
    private final Long id;
    private final String managementNumber;
    private final String address;
    private final CctvPurpose purpose;
    private final int cameraCount;
    private final Integer cameraPixels;
    private final Integer retentionDays;
    private final BigDecimal latitude;
    private final BigDecimal longitude;

    private Cctv(Long id, String managementNumber, String address, CctvPurpose purpose, int cameraCount,
                 Integer cameraPixels, Integer retentionDays, BigDecimal latitude, BigDecimal longitude) {
        this.id = validateRequired(id, "CCTV ID는 필수입니다.");
        this.managementNumber = validateText(managementNumber, "CCTV 관리번호는 필수입니다.");
        this.address = validateText(address, "CCTV 주소는 필수입니다.");
        this.purpose = validateRequired(purpose, "CCTV 설치목적은 필수입니다.");
        this.cameraCount = validatePositive(cameraCount, "CCTV 카메라 대수는 1 이상이어야 합니다.");
        this.cameraPixels = validatePositiveOrNull(cameraPixels, "CCTV 카메라 화소수는 1 이상이어야 합니다.");
        this.retentionDays = validatePositiveOrNull(retentionDays, "CCTV 보관일수는 1 이상이어야 합니다.");
        this.latitude = validateCoordinate(latitude, MAX_LATITUDE, "CCTV 위도가 올바르지 않습니다.");
        this.longitude = validateCoordinate(longitude, MAX_LONGITUDE, "CCTV 경도가 올바르지 않습니다.");
    }

    // CCTV는 적재 스크립트로 정제해 넣은 참조 데이터다. 값이 어긋나면 서버 데이터 문제다.
    public static Cctv reconstruct(Long id, String managementNumber, String address, CctvPurpose purpose,
                                   int cameraCount, Integer cameraPixels, Integer retentionDays,
                                   BigDecimal latitude, BigDecimal longitude) {
        return new Cctv(id, managementNumber, address, purpose, cameraCount, cameraPixels, retentionDays,
                latitude, longitude);
    }

    public double distanceMetersFrom(BigDecimal latitude, BigDecimal longitude) {
        return GeoDistance.meters(latitude, longitude, this.latitude, this.longitude);
    }

    private static <T> T validateRequired(T value, String message) {
        if (value == null) {
            throw new IllegalArgumentException(message);
        }
        return value;
    }

    private static String validateText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(message);
        }
        return value;
    }

    private static int validatePositive(int value, String message) {
        if (value <= 0) {
            throw new IllegalArgumentException(message);
        }
        return value;
    }

    private static Integer validatePositiveOrNull(Integer value, String message) {
        if (value != null && value <= 0) {
            throw new IllegalArgumentException(message);
        }
        return value;
    }

    private static BigDecimal validateCoordinate(BigDecimal value, BigDecimal limit, String message) {
        if (value == null || value.abs().compareTo(limit) > 0) {
            throw new IllegalArgumentException(message);
        }
        return value;
    }
}
