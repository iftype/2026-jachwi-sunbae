package com.jachwisunbae.transit.provider.geojson;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.jachwisunbae.transit.domain.vo.AdminDongBoundary;
import java.util.ArrayList;
import java.util.List;

// GeoJSON Polygon·MultiPolygon geometry를 행정동 경계로 바꾼다. 파일에서 읽을 때와 DB에서 다시 읽을 때 함께 쓴다.
// 경계는 이미 약 15m 오차로 단순화한 지도용 데이터라, 좌표를 소수점 5자리(약 1m)로 반올림해 저장·응답 크기를 줄인다.
public final class GeoJsonBoundaries {

    private static final double COORDINATE_SCALE = 100_000;

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
        return new AdminDongBoundary(toGeoJson(type, polygons), polygons);
    }

    // 반올림한 좌표로 GeoJSON을 다시 만들어, 판정에 쓰는 좌표와 저장·응답하는 좌표가 같게 한다.
    private static String toGeoJson(final String type, final List<List<double[]>> polygons) {
        ObjectNode geometry = JsonNodeFactory.instance.objectNode().put("type", type);
        ArrayNode coordinates = geometry.putArray("coordinates");
        for (List<double[]> rings : polygons) {
            ArrayNode polygon = "Polygon".equals(type) ? coordinates : coordinates.addArray();
            for (double[] ring : rings) {
                ArrayNode points = polygon.addArray();
                for (int index = 0; index < ring.length; index += 2) {
                    points.addArray().add(ring[index]).add(ring[index + 1]);
                }
            }
        }
        return geometry.toString();
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
            values[index * 2] = round(point.get(0).asDouble());
            values[index * 2 + 1] = round(point.get(1).asDouble());
        }
        return values;
    }

    private static double round(final double value) {
        return Math.round(value * COORDINATE_SCALE) / COORDINATE_SCALE;
    }
}
