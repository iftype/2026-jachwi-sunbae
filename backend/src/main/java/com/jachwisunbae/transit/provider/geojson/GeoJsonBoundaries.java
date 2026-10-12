package com.jachwisunbae.transit.provider.geojson;

import com.fasterxml.jackson.databind.JsonNode;
import com.jachwisunbae.transit.domain.vo.AdminDongBoundary;
import java.util.ArrayList;
import java.util.List;

// GeoJSON Polygon·MultiPolygon geometry를 행정동 경계로 바꾼다. 파일에서 읽을 때와 DB에서 다시 읽을 때 함께 쓴다.
public final class GeoJsonBoundaries {

    private GeoJsonBoundaries() {
    }

    public static AdminDongBoundary toBoundary(final JsonNode geometry) {
        String type = geometry.path("type").asText();
        JsonNode coordinates = geometry.path("coordinates");
        List<List<double[]>> polygons = new ArrayList<>();
        if ("Polygon".equals(type)) {
            polygons.add(rings(coordinates));
        } else if ("MultiPolygon".equals(type)) {
            coordinates.forEach(polygon -> polygons.add(rings(polygon)));
        } else {
            throw new IllegalArgumentException("Polygon 또는 MultiPolygon이 아닌 경계입니다. type=" + type);
        }
        return new AdminDongBoundary(geometry.toString(), polygons);
    }

    private static List<double[]> rings(final JsonNode polygon) {
        List<double[]> rings = new ArrayList<>();
        polygon.forEach(ring -> rings.add(flatten(ring)));
        return rings;
    }

    // [[경도, 위도], ...]를 [경도, 위도, 경도, 위도, ...]로 펼친다.
    private static double[] flatten(final JsonNode ring) {
        double[] values = new double[ring.size() * 2];
        for (int index = 0; index < ring.size(); index++) {
            JsonNode point = ring.get(index);
            if (point.size() < 2 || !point.get(0).isNumber() || !point.get(1).isNumber()) {
                throw new IllegalArgumentException("경계 좌표는 [경도, 위도] 숫자 쌍이어야 합니다.");
            }
            values[index * 2] = point.get(0).asDouble();
            values[index * 2 + 1] = point.get(1).asDouble();
        }
        return values;
    }
}
