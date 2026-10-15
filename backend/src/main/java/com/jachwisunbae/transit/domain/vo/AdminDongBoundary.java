package com.jachwisunbae.transit.domain.vo;

import java.util.List;

// 행정동 경계다. GeoJSON Polygon·MultiPolygon의 좌표를 판정용으로 들고, 저장·응답용 GeoJSON 원문도 함께 갖는다.
// 폴리곤마다 첫 고리가 바깥 경계, 나머지 고리가 구멍이며, 고리는 [경도, 위도, 경도, 위도, ...]로 펼친 배열이다.
public final class AdminDongBoundary {

    private final String geoJson;
    private final List<List<double[]>> polygons;
    private final double minLatitude;
    private final double minLongitude;
    private final double maxLatitude;
    private final double maxLongitude;

    public AdminDongBoundary(final String geoJson, final List<List<double[]>> polygons) {
        if (geoJson == null || geoJson.isBlank()) {
            throw new IllegalArgumentException("행정동 경계 GeoJSON이 필요합니다.");
        }
        if (polygons.isEmpty() || polygons.stream().anyMatch(rings -> rings.isEmpty() || hasShortRing(rings))) {
            throw new IllegalArgumentException("행정동 경계에는 꼭짓점이 3개 이상인 바깥 고리가 있어야 합니다.");
        }
        this.geoJson = geoJson;
        this.polygons = polygons.stream().map(List::copyOf).toList();
        double[] bounds = bounds(this.polygons);
        this.minLongitude = bounds[0];
        this.minLatitude = bounds[1];
        this.maxLongitude = bounds[2];
        this.maxLatitude = bounds[3];
    }

    public String geoJson() {
        return geoJson;
    }

    public double minLatitude() {
        return minLatitude;
    }

    public double minLongitude() {
        return minLongitude;
    }

    public double maxLatitude() {
        return maxLatitude;
    }

    public double maxLongitude() {
        return maxLongitude;
    }

    // 바깥 고리 안에 있고 어떤 구멍에도 속하지 않으면 경계 안이다.
    public boolean contains(final Coordinate coordinate) {
        double longitude = coordinate.longitude();
        double latitude = coordinate.latitude();
        if (longitude < minLongitude || longitude > maxLongitude
                || latitude < minLatitude || latitude > maxLatitude) {
            return false;
        }
        return polygons.stream().anyMatch(rings -> polygonContains(rings, longitude, latitude));
    }

    // 지도에 이름을 올릴 위치로, 가장 넓은 폴리곤 바깥 고리의 무게중심을 쓴다.
    // 오목한 동네는 무게중심이 경계 밖에 놓일 수 있다.
    public Coordinate center() {
        double[] largest = polygons.stream()
                .map(rings -> rings.get(0))
                .max((left, right) -> Double.compare(Math.abs(signedArea(left)), Math.abs(signedArea(right))))
                .orElseThrow();
        double area = signedArea(largest);
        if (area == 0) {
            return new Coordinate(largest[1], largest[0]);
        }
        double longitudeSum = 0;
        double latitudeSum = 0;
        for (int index = 0; index + 3 < largest.length; index += 2) {
            double cross = largest[index] * largest[index + 3] - largest[index + 2] * largest[index + 1];
            longitudeSum += (largest[index] + largest[index + 2]) * cross;
            latitudeSum += (largest[index + 1] + largest[index + 3]) * cross;
        }
        return new Coordinate(latitudeSum / (6 * area), longitudeSum / (6 * area));
    }

    private static boolean hasShortRing(final List<double[]> rings) {
        return rings.stream().anyMatch(ring -> ring.length < 6 || ring.length % 2 != 0);
    }

    private static boolean polygonContains(final List<double[]> rings, final double longitude,
                                           final double latitude) {
        if (!ringContains(rings.get(0), longitude, latitude)) {
            return false;
        }
        return rings.stream().skip(1).noneMatch(hole -> ringContains(hole, longitude, latitude));
    }

    // 점에서 오른쪽으로 그은 반직선이 고리의 변을 홀수 번 지나면 안쪽이다.
    private static boolean ringContains(final double[] ring, final double longitude, final double latitude) {
        boolean inside = false;
        int points = ring.length / 2;
        for (int current = 0, previous = points - 1; current < points; previous = current++) {
            double currentLongitude = ring[current * 2];
            double currentLatitude = ring[current * 2 + 1];
            double previousLongitude = ring[previous * 2];
            double previousLatitude = ring[previous * 2 + 1];
            if ((currentLatitude > latitude) != (previousLatitude > latitude)
                    && longitude < (previousLongitude - currentLongitude) * (latitude - currentLatitude)
                    / (previousLatitude - currentLatitude) + currentLongitude) {
                inside = !inside;
            }
        }
        return inside;
    }

    // 신발끈 공식으로 구한 넓이다. 고리가 닫혀 있지 않아도 마지막 점과 첫 점을 잇는다.
    private static double signedArea(final double[] ring) {
        double sum = 0;
        int points = ring.length / 2;
        for (int current = 0, previous = points - 1; current < points; previous = current++) {
            sum += ring[previous * 2] * ring[current * 2 + 1] - ring[current * 2] * ring[previous * 2 + 1];
        }
        return sum / 2;
    }

    private static double[] bounds(final List<List<double[]>> polygons) {
        double[] bounds = {Double.MAX_VALUE, Double.MAX_VALUE, -Double.MAX_VALUE, -Double.MAX_VALUE};
        for (List<double[]> rings : polygons) {
            double[] outer = rings.get(0);
            for (int index = 0; index < outer.length; index += 2) {
                bounds[0] = Math.min(bounds[0], outer[index]);
                bounds[1] = Math.min(bounds[1], outer[index + 1]);
                bounds[2] = Math.max(bounds[2], outer[index]);
                bounds[3] = Math.max(bounds[3], outer[index + 1]);
            }
        }
        return bounds;
    }
}
