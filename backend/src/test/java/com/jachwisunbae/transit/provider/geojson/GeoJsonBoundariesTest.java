package com.jachwisunbae.transit.provider.geojson;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jachwisunbae.transit.domain.vo.AdminDongBoundary;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class GeoJsonBoundariesTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("경계 좌표를 소수점 5자리로 반올림해 GeoJSON을 다시 만든다")
    void roundsCoordinates() throws Exception {
        AdminDongBoundary boundary = GeoJsonBoundaries.toBoundary(objectMapper.readTree("""
                {"type":"Polygon","coordinates":[[[126.97389564130287,37.579318446045434],
                  [126.99,37.579318446045434],[126.99,37.6],[126.97389564130287,37.579318446045434]]]}
                """));

        assertThat(objectMapper.readTree(boundary.geoJson())).isEqualTo(objectMapper.readTree("""
                {"type":"Polygon","coordinates":[[[126.9739,37.57932],[126.99,37.57932],[126.99,37.6],
                  [126.9739,37.57932]]]}
                """));
        assertThat(boundary.contains(new Coordinate(37.585, 126.985))).isTrue();
    }

    @Test
    @DisplayName("MultiPolygon은 폴리곤마다 고리 구조를 유지한다")
    void keepsMultiPolygonStructure() throws Exception {
        String geometry = """
                {"type":"MultiPolygon","coordinates":[
                  [[[124.6,37.9],[124.7,37.9],[124.7,38.0],[124.6,37.9]]],
                  [[[124.8,37.9],[124.9,37.9],[124.9,38.0],[124.8,37.9]],
                   [[124.85,37.92],[124.86,37.92],[124.86,37.93],[124.85,37.92]]]]}
                """;

        AdminDongBoundary boundary = GeoJsonBoundaries.toBoundary(objectMapper.readTree(geometry));

        assertThat(objectMapper.readTree(boundary.geoJson())).isEqualTo(objectMapper.readTree(geometry));
    }
}
