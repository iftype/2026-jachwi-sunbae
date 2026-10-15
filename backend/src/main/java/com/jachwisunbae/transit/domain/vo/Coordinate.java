package com.jachwisunbae.transit.domain.vo;

// WGS84 위도·경도다.
public record Coordinate(double latitude, double longitude) {

    private static final double EARTH_RADIUS_METERS = 6_371_000;

    // 범위를 반대로 묻지 않고 부정해, NaN도 범위 밖으로 걸러낸다.
    public Coordinate {
        if (!(latitude >= -90 && latitude <= 90)) {
            throw new IllegalArgumentException("위도는 -90 이상 90 이하여야 합니다. latitude=" + latitude);
        }
        if (!(longitude >= -180 && longitude <= 180)) {
            throw new IllegalArgumentException("경도는 -180 이상 180 이하여야 합니다. longitude=" + longitude);
        }
    }

    // 지구를 반지름 6,371km의 구로 보고 Haversine 공식으로 지표면 거리를 구한다.
    public double metersTo(final Coordinate other) {
        double fromLatitude = Math.toRadians(latitude);
        double toLatitude = Math.toRadians(other.latitude);
        double deltaLatitude = toLatitude - fromLatitude;
        double deltaLongitude = Math.toRadians(other.longitude - longitude);
        double haversine = Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2)
                + Math.cos(fromLatitude) * Math.cos(toLatitude)
                * Math.sin(deltaLongitude / 2) * Math.sin(deltaLongitude / 2);
        return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    }
}
