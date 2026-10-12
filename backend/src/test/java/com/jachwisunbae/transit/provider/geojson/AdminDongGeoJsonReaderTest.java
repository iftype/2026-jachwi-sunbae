package com.jachwisunbae.transit.provider.geojson;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.InternalSystemException;
import com.jachwisunbae.transit.domain.AdminDong;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class AdminDongGeoJsonReaderTest {

    @TempDir
    Path directory;

    private final AdminDongGeoJsonReader reader = new AdminDongGeoJsonReader(new ObjectMapper());

    @Test
    @DisplayName("Polygon과 MultiPolygon 행정동을 속성과 함께 읽는다")
    void readsPolygonAndMultiPolygon() throws IOException {
        Path file = write("""
                {"type":"FeatureCollection","name":"admin","features":[
                  {"type":"Feature","properties":{"code":"11010530","name":"사직동","sidoName":"서울특별시",
                    "sigunguName":"종로구","fullName":"서울특별시 종로구 사직동","baseDate":"20250630"},
                   "geometry":{"type":"Polygon",
                     "coordinates":[[[127.0,37.5],[127.1,37.5],[127.1,37.6],[127.0,37.6],[127.0,37.5]]]}},
                  {"type":"Feature","properties":{"code":"23310250","name":"백령면","sidoName":"인천광역시",
                    "sigunguName":"옹진군","fullName":"인천광역시 옹진군 백령면","baseDate":"20250630"},
                   "geometry":{"type":"MultiPolygon","coordinates":[
                     [[[124.6,37.9],[124.7,37.9],[124.7,38.0],[124.6,38.0],[124.6,37.9]]],
                     [[[124.8,37.9],[124.9,37.9],[124.9,38.0],[124.8,38.0],[124.8,37.9]]]]}}
                ]}
                """);

        List<AdminDong> adminDongs = reader.read(file);

        assertThat(adminDongs).extracting(AdminDong::code).containsExactly("11010530", "23310250");
        AdminDong sajik = adminDongs.get(0);
        assertThat(sajik.fullName()).isEqualTo("서울특별시 종로구 사직동");
        assertThat(sajik.baseDate()).isEqualTo(LocalDate.of(2025, 6, 30));
        assertThat(sajik.contains(new Coordinate(37.55, 127.05))).isTrue();
        assertThat(adminDongs.get(1).contains(new Coordinate(37.95, 124.85))).isTrue();
        assertThat(adminDongs.get(1).contains(new Coordinate(37.95, 124.75))).isFalse();
    }

    @Test
    @DisplayName("속성이 빠진 행정동이 있으면 위치를 알리고 적재를 멈춘다")
    void failsWhenPropertyIsMissing() throws IOException {
        Path file = write("""
                {"type":"FeatureCollection","features":[
                  {"type":"Feature","properties":{"code":"11010530","name":"사직동"},
                   "geometry":{"type":"Polygon","coordinates":[[[127.0,37.5],[127.1,37.5],[127.1,37.6],[127.0,37.5]]]}}
                ]}
                """);

        assertThatThrownBy(() -> reader.read(file))
                .isInstanceOf(InternalSystemException.class)
                .hasMessageContaining("features[0]")
                .hasMessageContaining("sidoName");
    }

    @Test
    @DisplayName("행정동 코드가 중복되면 적재를 멈춘다")
    void failsWhenCodeIsDuplicated() throws IOException {
        String feature = """
                {"type":"Feature","properties":{"code":"11010530","name":"사직동","sidoName":"서울특별시",
                  "sigunguName":"종로구","fullName":"서울특별시 종로구 사직동","baseDate":"20250630"},
                 "geometry":{"type":"Polygon","coordinates":[[[127.0,37.5],[127.1,37.5],[127.1,37.6],[127.0,37.5]]]}}
                """;
        Path file = write("{\"type\":\"FeatureCollection\",\"features\":[" + feature + "," + feature + "]}");

        assertThatThrownBy(() -> reader.read(file))
                .isInstanceOf(InternalSystemException.class)
                .hasMessageContaining("중복");
    }

    @Test
    @DisplayName("파일이 없으면 행정동 경계를 읽지 못했다고 알린다")
    void failsWhenFileIsMissing() {
        assertThatThrownBy(() -> reader.read(directory.resolve("none.geojson")))
                .isInstanceOf(InternalSystemException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.ADMIN_DONG_READ_FAILURE);
    }

    private Path write(final String content) throws IOException {
        return Files.writeString(directory.resolve("admin-dongs.geojson"), content);
    }
}
