package com.jachwisunbae.map.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import lombok.Getter;

// 위도·경도 범위로 만든 사각형. 경계값을 포함한다.
@Getter
public class CoordinateBounds {

    private static final int SCALE = 7;// 좌표 경계값을 소수점 7자리까지 저장
    private static final BigDecimal MAX_LATITUDE = BigDecimal.valueOf(90);
    private static final BigDecimal MAX_LONGITUDE = BigDecimal.valueOf(180);
    private final BigDecimal minLatitude;// 사각형의 남쪽 경계
    private final BigDecimal maxLatitude;// 사각형의 북쪽 경계
    private final BigDecimal minLongitude;// 사각형의 서쪽 경계
    private final BigDecimal maxLongitude;// 사각형의 동쪽 경계

    private CoordinateBounds(BigDecimal minLatitude, BigDecimal maxLatitude,
                             BigDecimal minLongitude, BigDecimal maxLongitude) {
        this.minLatitude = minLatitude;
        this.maxLatitude = maxLatitude;
        this.minLongitude = minLongitude;
        this.maxLongitude = maxLongitude;
    }

    public static CoordinateBounds of(BigDecimal minLatitude, BigDecimal maxLatitude,
                                      BigDecimal minLongitude, BigDecimal maxLongitude) {
        validateRange(minLatitude, maxLatitude, "위도 범위가 올바르지 않습니다.");
        validateRange(minLongitude, maxLongitude, "경도 범위가 올바르지 않습니다.");
        return new CoordinateBounds(minLatitude, maxLatitude, minLongitude, maxLongitude);
    }

    // 중심 좌표에서 반경 거리의 원을 감싸는 가장 작은 사각형을 만든다. 원보다 넓으므로 실제 거리로 다시 걸러야 한다.
    // 거리 계산(GeoDistance)과 같은 구면 모델을 써야 반경 경계의 좌표가 사각형 밖으로 빠지지 않는다.
    // 경도 폭은 위도가 높을수록 넓어진다. 극에 가까워 원이 극을 덮으면 경도 전체를 쓴다.
    // 좌표 범위를 넘으면 경계에서 자른다. 날짜변경선을 넘는 범위는 다루지 않는다.
    public static CoordinateBounds around(BigDecimal latitude, BigDecimal longitude, int radiusMeters) {
        if (latitude == null || longitude == null || radiusMeters <= 0) {
            throw new IllegalArgumentException("중심 좌표와 양수 반경이 필요합니다.");
        }

        //좌표는 도 단위이고 반경은 미터 단위이므로, 먼저 단위를 맞춘다.
        // 호의 길이 = 지구 반지름 × 중심각이므로, 거리 / 지구 반지름으로 중심각을 구한다.
        double angularRadius = radiusMeters / GeoDistance.EARTH_RADIUS_METERS; // 반경 거리를 라디안 단위의 각도로 변환
        double latitudeDelta = Math.toDegrees(angularRadius); // 중심에서 남북으로 확장할 위도 변화량을 도 단위로 변환

        // 경도선 사이의 실제 거리는 위도에 따라 달라지므로, 중심 위도를 반영해 경도 변화량을 계산한다.
        double ratio = Math.sin(angularRadius)
                / Math.cos(Math.toRadians(latitude.doubleValue())); // 중심 위도를 라디안으로 바꿔 경도 범위 계산에 반영

        double longitudeDelta = ratio >= 1
                ? MAX_LONGITUDE.doubleValue() // 검색 원이 극점에 닿거나 덮는 경우 경도 변화량을 180도로 설정
                : Math.toDegrees(Math.asin(ratio)); // 그 외에는 asin으로 경도 변화량을 구한 뒤 도 단위로 변환

        return of(lowerBound(latitude, latitudeDelta, MAX_LATITUDE),
                upperBound(latitude, latitudeDelta, MAX_LATITUDE),
                lowerBound(longitude, longitudeDelta, MAX_LONGITUDE),
                upperBound(longitude, longitudeDelta, MAX_LONGITUDE));
    }

    // 최소 경계를 계산한다. 범위가 줄어들지 않도록 음의 방향으로 내림한다.
    private static BigDecimal lowerBound(BigDecimal center, double delta, BigDecimal limit) {
        BigDecimal value = center
                .subtract(BigDecimal.valueOf(delta)) // 중심 좌표에서 변화량을 뺌
                .setScale(SCALE, RoundingMode.FLOOR); // 소수점 7자리에서 내림하여 경계를 바깥쪽으로 확장

        return value.max(limit.negate()); // 계산값과 하한(-90 또는 -180) 중 큰 값을 선택해 하한 미만으로 내려가지 않게 함
    }

    // 최대 경계를 계산한다. 범위가 줄어들지 않도록 양의 방향으로 올림한다.
    private static BigDecimal upperBound(BigDecimal center, double delta, BigDecimal limit) {
        BigDecimal value = center
                .add(BigDecimal.valueOf(delta)) // 중심 좌표에 변화량을 더함
                .setScale(SCALE, RoundingMode.CEILING); // 소수점 7자리에서 올림하여 경계를 바깥쪽으로 확장

        return value.min(limit); // 계산값과 상한(90 또는 180) 중 작은 값을 선택해 상한을 넘지 않게 함
    }

    private static void validateRange(BigDecimal min, BigDecimal max, String message) {
        if (min == null || max == null || min.compareTo(max) > 0) {
            throw new IllegalArgumentException(message);
        }
    }
}
