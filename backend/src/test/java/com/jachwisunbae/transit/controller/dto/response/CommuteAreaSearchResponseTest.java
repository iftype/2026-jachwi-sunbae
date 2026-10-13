package com.jachwisunbae.transit.controller.dto.response;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jachwisunbae.transit.domain.AdminDong;
import com.jachwisunbae.transit.domain.CommuteArea;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.ReachableStop;
import com.jachwisunbae.transit.domain.vo.AdminDongBoundary;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import com.jachwisunbae.transit.domain.vo.Seconds;
import com.jachwisunbae.transit.service.dto.result.CommuteAreaSearchResult;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CommuteAreaSearchResponseTest {

    private static final String GEO_JSON = "{\"type\":\"Polygon\",\"coordinates\":"
            + "[[[127.0,37.5],[127.1,37.5],[127.1,37.6],[127.0,37.6],[127.0,37.5]]]}";

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("동네 경계는 GeoJSON 객체로, 정류장 통근 시간은 분 단위로 내보낸다")
    void serializes() throws Exception {
        AdminDong adminDong = new AdminDong("11230640", "역삼1동", "서울특별시", "강남구", "서울특별시 강남구 역삼1동",
                LocalDate.of(2025, 6, 30), new AdminDongBoundary(GEO_JSON,
                List.of(List.of(new double[]{127.0, 37.5, 127.1, 37.5, 127.1, 37.6, 127.0, 37.6, 127.0, 37.5}))));
        GtfsStop station = new GtfsStop("S1", "역삼역", new Coordinate(37.55, 127.05), "11230640");
        CommuteAreaSearchResult result = new CommuteAreaSearchResult(40, List.of(new CommuteArea(adminDong,
                List.of(new ReachableStop(station, new Seconds(150), null)))));

        JsonNode json = objectMapper.readTree(objectMapper.writeValueAsString(CommuteAreaSearchResponse.from(result)));

        assertThat(json.path("maxMinutes").asInt()).isEqualTo(40);
        assertThat(json.path("areaCount").asInt()).isEqualTo(1);
        JsonNode area = json.path("areas").get(0);
        assertThat(area.path("adminDongCode").asText()).isEqualTo("11230640");
        assertThat(area.path("commuteMinutes").asInt()).isEqualTo(3);
        assertThat(area.path("boundary")).isEqualTo(objectMapper.readTree(GEO_JSON));
        assertThat(area.path("center").path("latitude").asDouble()).isCloseTo(37.55, within(0.001));
        JsonNode stationJson = area.path("stations").get(0);
        assertThat(stationJson.path("travelMinutes").asInt()).isEqualTo(3);
        assertThat(stationJson.has("direction")).isTrue();
        assertThat(stationJson.path("direction").isNull()).isTrue();
    }
}
