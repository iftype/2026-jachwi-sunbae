package com.jachwisunbae.transit.domain.vo;

// WGS84 위도·경도다.
public record Coordinate(double latitude, double longitude) {

    // 범위를 반대로 묻지 않고 부정해, NaN도 범위 밖으로 걸러낸다.
    public Coordinate {
        if (!(latitude >= -90 && latitude <= 90)) {
            throw new IllegalArgumentException("위도는 -90 이상 90 이하여야 합니다. latitude=" + latitude);
        }
        if (!(longitude >= -180 && longitude <= 180)) {
            throw new IllegalArgumentException("경도는 -180 이상 180 이하여야 합니다. longitude=" + longitude);
        }
    }
}
