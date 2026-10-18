package com.jachwisunbae.transit.controller.dto.response;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.search.CommuteRoute;
import com.jachwisunbae.transit.domain.search.RouteLeg;
import com.jachwisunbae.transit.domain.search.RoutePoint;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import com.jachwisunbae.transit.domain.vo.Seconds;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CommuteRouteResponseTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("구간마다 종류, 노선 이름, 분 단위 시간과 지나는 지점을 내보내고 목적지는 정류장 ID가 없다")
    void serializes() throws Exception {
        RoutePoint gangnam = RoutePoint.of(new GtfsStop("S1", "강남역", new Coordinate(37.4979, 127.0276)));
        RoutePoint yeoksam = RoutePoint.of(new GtfsStop("S2", "역삼역", new Coordinate(37.5006, 127.0364)));
        CommuteRoute route = new CommuteRoute(new Seconds(500), 0, List.of(
                new RouteLeg(RouteLeg.Type.SUBWAY, "2호선", List.of(gangnam, yeoksam), new Seconds(90), new Seconds(240)),
                new RouteLeg(RouteLeg.Type.WALK, null,
                        List.of(yeoksam, RoutePoint.destination(new Coordinate(37.5, 127.0385))),
                        new Seconds(170), new Seconds(0))));

        JsonNode json = objectMapper.readTree(objectMapper.writeValueAsString(CommuteRouteResponse.from(route)));

        assertThat(json.path("totalMinutes").asInt()).isEqualTo(9);
        assertThat(json.path("transferCount").asInt()).isZero();
        JsonNode subway = json.path("legs").get(0);
        assertThat(subway.path("type").asText()).isEqualTo("SUBWAY");
        assertThat(subway.path("routeName").asText()).isEqualTo("2호선");
        assertThat(subway.path("minutes").asInt()).isEqualTo(2);
        assertThat(subway.path("waitMinutes").asInt()).isEqualTo(4);
        assertThat(subway.path("points")).extracting(point -> point.path("name").asText())
                .containsExactly("강남역", "역삼역");
        JsonNode walk = json.path("legs").get(1);
        assertThat(walk.path("routeName").isNull()).isTrue();
        assertThat(walk.path("points").get(1).path("stopId").isNull()).isTrue();
        assertThat(walk.path("points").get(1).path("name").asText()).isEqualTo("목적지");
    }
}
