package com.jachwisunbae.map.domain.agency;

import java.math.BigDecimal;
import java.util.Objects;

// 주변 중개업소. 전화번호와 상세 페이지 URL은 공급자에 정보가 없으면 null이다.
public record Agency(String providerPlaceId, String name, String address, BigDecimal latitude,
                     BigDecimal longitude, int distanceMeters, String phone, String placeUrl) {

    private static final BigDecimal MAX_LATITUDE = BigDecimal.valueOf(90);
    private static final BigDecimal MAX_LONGITUDE = BigDecimal.valueOf(180);

    public Agency {
        requireText(providerPlaceId, "중개업소 ID가 필요합니다.");
        requireText(name, "중개업소 이름이 필요합니다.");
        requireCoordinate(latitude, MAX_LATITUDE, "중개업소 위도가 올바르지 않습니다.");
        requireCoordinate(longitude, MAX_LONGITUDE, "중개업소 경도가 올바르지 않습니다.");
        if (distanceMeters < 0) {
            throw new IllegalArgumentException("중개업소 거리는 0 이상이어야 합니다.");
        }
        address = Objects.requireNonNullElse(address, "");
        phone = blankToNull(phone);
        placeUrl = blankToNull(placeUrl);
    }

    private static void requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(message);
        }
    }

    private static void requireCoordinate(BigDecimal value, BigDecimal limit, String message) {
        if (value == null || value.abs().compareTo(limit) > 0) {
            throw new IllegalArgumentException(message);
        }
    }

    private static String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value;
    }
}
