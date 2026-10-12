package com.jachwisunbae.map.domain;

import java.math.BigDecimal;
import lombok.Getter;

@Getter
public class BusStop {

    private static final BigDecimal MAX_LATITUDE = BigDecimal.valueOf(90);
    private static final BigDecimal MAX_LONGITUDE = BigDecimal.valueOf(180);
    private final String nodeId;
    private final String name;
    private final BigDecimal latitude;
    private final BigDecimal longitude;
    private final String cityCode;

    private BusStop(String nodeId, String name, BigDecimal latitude, BigDecimal longitude, String cityCode) {
        this.nodeId = nodeId;
        this.name = name;
        this.latitude = latitude;
        this.longitude = longitude;
        this.cityCode = cityCode;
    }

    // 정류장은 적재 스크립트로 정제해 넣은 참조 데이터다. 값이 어긋나면 서버 데이터 문제다.
    public static BusStop reconstruct(String nodeId, String name, BigDecimal latitude, BigDecimal longitude,
                                      String cityCode) {
        return new BusStop(validateText(nodeId, "정류장 ID는 필수입니다."),
                validateText(name, "정류장 이름은 필수입니다."),
                validateCoordinate(latitude, MAX_LATITUDE, "정류장 위도가 올바르지 않습니다."),
                validateCoordinate(longitude, MAX_LONGITUDE, "정류장 경도가 올바르지 않습니다."),
                validateText(cityCode, "정류장 도시 코드는 필수입니다."));
    }

    public double distanceMetersFrom(BigDecimal latitude, BigDecimal longitude) {
        return GeoDistance.meters(latitude, longitude, this.latitude, this.longitude);
    }

    private static String validateText(String value, String message) {
        if (value == null || value.isBlank()) {
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
