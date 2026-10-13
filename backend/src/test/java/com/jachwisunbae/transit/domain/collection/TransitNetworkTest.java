package com.jachwisunbae.transit.domain.collection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.transit.domain.GtfsEdge;
import com.jachwisunbae.transit.domain.GtfsRoute;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.GtfsTransfer;
import com.jachwisunbae.transit.domain.ReachableStop;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import com.jachwisunbae.transit.domain.vo.Seconds;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class TransitNetworkTest {

    // 목적지에서 동쪽으로 약 265m(도보 221초) 떨어진 정류장 A에 버스 R1(C → B → A)과 지하철 R2(S → A)가 도착한다.
    // 버스 R3(E → C)는 R1으로 갈아타야 목적지에 닿고, G에서 C까지는 걸어서 환승한다.
    private static final Coordinate DESTINATION = new Coordinate(37.5000, 127.0000);

    private static final GtfsStop A = stop("A", 37.5000, 127.0030);
    private static final GtfsStop B = stop("B", 37.5100, 127.0030);
    private static final GtfsStop C = stop("C", 37.5200, 127.0030);
    private static final GtfsStop E = stop("E", 37.5200, 127.0130);
    private static final GtfsStop G = stop("G", 37.5210, 127.0030);
    private static final GtfsStop S = stop("S", 37.5000, 127.0300);
    private static final GtfsStop FAR = stop("FAR", 37.6000, 127.0000);

    private final TransitNetwork network = new TransitNetwork(
            List.of(A, B, C, E, G, S, FAR),
            List.of(route("R1", 3, 300), route("R2", 1, 120), route("R3", 3, 200)),
            List.of(edge("R1", "C", "B", 120), edge("R1", "B", "A", 120),
                    edge("R2", "S", "A", 300), edge("R3", "E", "C", 60)),
            List.of(new GtfsTransfer("G", "C", new Seconds(90))));

    @Test
    @DisplayName("도착 정류장까지 걷는 시간과 노선마다 한 번의 대기 시간을 더해 통근 시간을 구한다")
    void addsWalkAndWaitTime() {
        Map<String, Integer> seconds = travelSeconds(network.reachableStops(DESTINATION, new Seconds(3600), 2));

        assertThat(seconds).containsEntry("A", 221)
                .containsEntry("B", 221 + 120 + 300)
                .containsEntry("C", 221 + 120 + 120 + 300)
                .containsEntry("S", 221 + 300 + 120)
                .containsEntry("G", 221 + 120 + 120 + 300 + 90)
                .containsEntry("E", 221 + 120 + 120 + 300 + 60 + 200)
                .doesNotContainKey("FAR");
    }

    @Test
    @DisplayName("통근 시간이 짧은 순서로 정류장을 돌려준다")
    void sortsByTravelTime() {
        List<ReachableStop> stops = network.reachableStops(DESTINATION, new Seconds(3600), 2);

        assertThat(stops).extracting(stop -> stop.stop().stopId())
                .containsExactly("A", "B", "S", "C", "G", "E");
        assertThat(stops.get(3).travelMinutes()).isEqualTo(13);
    }

    @Test
    @DisplayName("제한 시간을 넘는 정류장은 뺀다")
    void excludesStopsOverLimit() {
        Map<String, Integer> seconds = travelSeconds(network.reachableStops(DESTINATION, new Seconds(641), 2));

        assertThat(seconds).containsOnlyKeys("A", "B", "S");
    }

    @Test
    @DisplayName("환승 횟수가 최대 환승 횟수를 넘는 경로는 버린다")
    void limitsTransfers() {
        Map<String, Integer> seconds = travelSeconds(network.reachableStops(DESTINATION, new Seconds(3600), 0));

        assertThat(seconds).containsKeys("A", "B", "C", "G", "S").doesNotContainKey("E");
    }

    @Test
    @DisplayName("버스 정류장은 다음 정류장 쪽 8방위를, 역과 다음 정류장이 없는 정류장은 방향을 비운다")
    void findsDirection() {
        Map<String, String> directions = network.reachableStops(DESTINATION, new Seconds(3600), 2).stream()
                .filter(stop -> stop.direction() != null)
                .collect(Collectors.toMap(stop -> stop.stop().stopId(), ReachableStop::direction));

        assertThat(directions).containsOnly(Map.entry("B", "남"), Map.entry("C", "남"), Map.entry("E", "서"));
    }

    @Test
    @DisplayName("목적지에서 걸어서 10분 안에 정류장이 있는지 알려준다")
    void findsArrivalStop() {
        assertThat(network.hasArrivalStop(DESTINATION)).isTrue();
        assertThat(network.hasArrivalStop(new Coordinate(35.0, 129.0))).isFalse();
    }

    @Test
    @DisplayName("노선망에 없는 정류장을 잇는 구간이 있으면 만들지 않는다")
    void rejectsUnknownStop() {
        assertThatThrownBy(() -> new TransitNetwork(List.of(A), List.of(route("R1", 3, 300)),
                List.of(edge("R1", "NONE", "A", 60)), List.of()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("NONE");
    }

    private static Map<String, Integer> travelSeconds(final List<ReachableStop> stops) {
        return stops.stream().collect(Collectors.toMap(stop -> stop.stop().stopId(),
                stop -> stop.travelTime().value()));
    }

    private static GtfsStop stop(final String stopId, final double latitude, final double longitude) {
        return new GtfsStop(stopId, stopId + " 정류장", new Coordinate(latitude, longitude), null);
    }

    private static GtfsRoute route(final String routeId, final int routeType, final int waitSeconds) {
        return new GtfsRoute(routeId, routeId, routeId, routeType, new Seconds(waitSeconds));
    }

    private static GtfsEdge edge(final String routeId, final String from, final String to, final int seconds) {
        return new GtfsEdge(routeId, from, to, new Seconds(seconds));
    }
}
