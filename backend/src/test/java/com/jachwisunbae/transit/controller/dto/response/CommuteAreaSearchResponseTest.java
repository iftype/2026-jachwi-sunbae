package com.jachwisunbae.transit.controller.dto.response;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jachwisunbae.transit.domain.CommuteArea;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.ReachableStop;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import com.jachwisunbae.transit.domain.vo.Seconds;
import com.jachwisunbae.transit.service.dto.result.CommuteAreaSearchResult;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CommuteAreaSearchResponseTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("동네는 행정동 코드와 통근 시간, 정류장만 내보내고 정류장 통근 시간은 분 단위로, 사용을 중단한 방향은 null로 내보낸다")
    void serializes() throws Exception {
        GtfsStop station = new GtfsStop("S1", "역삼역", new Coordinate(37.55, 127.05), "11230640");
        CommuteAreaSearchResult result = new CommuteAreaSearchResult(40, List.of(new CommuteArea("11230640",
                List.of(new ReachableStop(station, new Seconds(150))))));

        JsonNode json = objectMapper.readTree(objectMapper.writeValueAsString(CommuteAreaSearchResponse.from(result)));

        assertThat(json.path("maxMinutes").asInt()).isEqualTo(40);
        assertThat(json.path("areaCount").asInt()).isEqualTo(1);
        JsonNode area = json.path("areas").get(0);
        assertThat(area.fieldNames()).toIterable().containsExactly("adminDongCode", "commuteMinutes", "stations");
        assertThat(area.path("adminDongCode").asText()).isEqualTo("11230640");
        assertThat(area.path("commuteMinutes").asInt()).isEqualTo(3);
        JsonNode stationJson = area.path("stations").get(0);
        assertThat(stationJson.path("travelMinutes").asInt()).isEqualTo(3);
        assertThat(stationJson.has("direction")).isTrue();
        assertThat(stationJson.path("direction").isNull()).isTrue();
    }
}
