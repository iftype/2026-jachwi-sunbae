package com.jachwisunbae.map.domain;

import java.math.BigDecimal;

// 두 좌표 사이의 지표면 거리를 Haversine 공식으로 계산한다. 지구를 반지름 6,371km의 구로 본다.
public final class GeoDistance {

    public static final double EARTH_RADIUS_METERS = 6_371_000;

    private GeoDistance() {
    }

    public static double meters(BigDecimal fromLatitude, BigDecimal fromLongitude,
                                BigDecimal toLatitude, BigDecimal toLongitude) {
        double fromLat = Math.toRadians(fromLatitude.doubleValue());
        double toLat = Math.toRadians(toLatitude.doubleValue());
        double deltaLat = toLat - fromLat;
        double deltaLon = Math.toRadians(toLongitude.doubleValue() - fromLongitude.doubleValue());
        double haversine = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2)
                + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
        return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    }
}
