package com.jachwisunbae.transit.domain.network;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.transit.domain.CommuteRoute;
import com.jachwisunbae.transit.domain.GtfsEdge;
import com.jachwisunbae.transit.domain.GtfsRoute;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.GtfsTransfer;
import com.jachwisunbae.transit.domain.ReachableStop;
import com.jachwisunbae.transit.domain.RouteLeg;
import com.jachwisunbae.transit.domain.RoutePoint;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import com.jachwisunbae.transit.domain.vo.Seconds;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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

    @Test
    @DisplayName("출발 정류장에서 목적지까지 노선마다 구간을 묶고 마지막에 걷는 구간을 붙인다")
    void findsRouteWithTransfer() {
        CommuteRoute route = network.route("E", DESTINATION, new Seconds(3600), 2).orElseThrow();

        assertThat(route.totalTime().value()).isEqualTo(221 + 120 + 120 + 300 + 60 + 200);
        assertThat(route.transferCount()).isEqualTo(1);
        assertThat(route.legs()).extracting(RouteLeg::type)
                .containsExactly(RouteLeg.Type.BUS, RouteLeg.Type.BUS, RouteLeg.Type.WALK);
        RouteLeg r3 = route.legs().get(0);
        assertThat(r3.routeName()).isEqualTo("R3");
        assertThat(r3.points()).extracting(RoutePoint::stopId).containsExactly("E", "C");
        assertThat(r3.rideTime().value()).isEqualTo(60);
        assertThat(r3.waitTime().value()).isEqualTo(200);
        RouteLeg r1 = route.legs().get(1);
        assertThat(r1.points()).extracting(RoutePoint::stopId).containsExactly("C", "B", "A");
        assertThat(r1.rideTime().value()).isEqualTo(240);
        RouteLeg walk = route.legs().get(2);
        assertThat(walk.points()).extracting(RoutePoint::name).containsExactly("A 정류장", "목적지");
        assertThat(walk.rideTime().value()).isEqualTo(221);
    }

    @Test
    @DisplayName("경로의 통근 시간은 생활권 탐색에서 구한 정류장 통근 시간과 같다")
    void matchesReachableStops() {
        Map<String, Integer> seconds = travelSeconds(network.reachableStops(DESTINATION, new Seconds(3600), 2));

        for (String stopId : seconds.keySet()) {
            assertThat(network.route(stopId, DESTINATION, new Seconds(3600), 2).orElseThrow().totalTime().value())
                    .as(stopId)
                    .isEqualTo(seconds.get(stopId));
        }
    }

    @Test
    @DisplayName("걸어서 환승하는 구간은 도보 구간이 된다")
    void findsWalkTransfer() {
        CommuteRoute route = network.route("G", DESTINATION, new Seconds(3600), 2).orElseThrow();

        assertThat(route.legs()).extracting(RouteLeg::type)
                .containsExactly(RouteLeg.Type.WALK, RouteLeg.Type.BUS, RouteLeg.Type.WALK);
        assertThat(route.legs().get(0).points()).extracting(RoutePoint::stopId).containsExactly("G", "C");
        assertThat(route.transferCount()).isZero();
    }

    @Test
    @DisplayName("지하철 구간은 SUBWAY로 나타낸다")
    void marksSubway() {
        CommuteRoute route = network.route("S", DESTINATION, new Seconds(3600), 2).orElseThrow();

        assertThat(route.legs().getFirst().type()).isEqualTo(RouteLeg.Type.SUBWAY);
        assertThat(route.legs().getFirst().waitTime().value()).isEqualTo(120);
    }

    @Test
    @DisplayName("최대 통근 시간이나 최대 환승 횟수 안에 경로가 없으면 비어 있다")
    void returnsEmptyWhenNoRoute() {
        assertThat(network.route("E", DESTINATION, new Seconds(600), 2)).isEmpty();
        assertThat(network.route("E", DESTINATION, new Seconds(3600), 0)).isEmpty();
        assertThat(network.route("FAR", DESTINATION, new Seconds(3600), 2)).isEmpty();
    }

    @Test
    @DisplayName("도착 정류장에서 출발하면 걷는 구간만 있다")
    void walksFromArrivalStop() {
        CommuteRoute route = network.route("A", DESTINATION, new Seconds(3600), 2).orElseThrow();

        assertThat(route.legs()).extracting(RouteLeg::type).containsExactly(RouteLeg.Type.WALK);
        assertThat(route.totalMinutes()).isEqualTo(4);
    }

    @Test
    @DisplayName("출발지에서 걸어서 10분 안의 정류장까지 걷는 시간을 정류장의 통근 시간에 더한다")
    void addsWalkFromOrigin() {
        Coordinate nearB = new Coordinate(37.5100, 127.0040);

        List<Optional<Seconds>> times = network.travelTimes(DESTINATION, List.of(nearB), new Seconds(3600), 2);

        assertThat(times).containsExactly(Optional.of(new Seconds(walkSeconds(nearB, B) + 221 + 120 + 300)));
    }

    @Test
    @DisplayName("목적지까지 걸어서 10분 안이면 정류장을 거치는 것보다 빠를 때 걷는 시간을 쓴다")
    void walksDirectlyToDestination() {
        Coordinate nearDestination = new Coordinate(37.5000, 127.0010);

        List<Optional<Seconds>> times = network.travelTimes(DESTINATION, List.of(nearDestination),
                new Seconds(3600), 2);

        assertThat(times).containsExactly(Optional.of(new Seconds(
                (int) Math.ceil(nearDestination.metersTo(DESTINATION) / TransitNetwork.WALKING_METERS_PER_SECOND))));
    }

    @Test
    @DisplayName("제한 시간 안에 닿지 못하는 출발지는 비워 두고 출발지 순서를 지킨다")
    void leavesUnreachableOriginsEmpty() {
        Coordinate nearB = new Coordinate(37.5100, 127.0040);
        Coordinate nearFar = new Coordinate(37.6000, 127.0010);
        int nearBSeconds = walkSeconds(nearB, B) + 221 + 120 + 300;

        assertThat(network.travelTimes(DESTINATION, List.of(nearFar, nearB), new Seconds(3600), 2))
                .containsExactly(Optional.empty(), Optional.of(new Seconds(nearBSeconds)));
        assertThat(network.travelTimes(DESTINATION, List.of(nearB), new Seconds(nearBSeconds - 1), 2))
                .containsExactly(Optional.empty());
    }

    @Test
    @DisplayName("100m 안의 버스 정류장과 역은 GTFS 환승이 없어도 걸어서 갈아탄다")
    void walksBetweenNearbyBusStopAndStation() {
        GtfsStop busStop = stop("P", 37.5100, 127.0300);
        GtfsStop station = stop("R", 37.5108, 127.0300);
        TransitNetwork mixed = busAndSubway(busStop, station);

        CommuteRoute route = mixed.route("X", DESTINATION, new Seconds(3600), 2).orElseThrow();

        assertThat(route.legs()).extracting(RouteLeg::type).containsExactly(RouteLeg.Type.BUS, RouteLeg.Type.WALK,
                RouteLeg.Type.SUBWAY, RouteLeg.Type.WALK);
        int walkSeconds = (int) Math.ceil(busStop.coordinate().metersTo(station.coordinate())
                / TransitNetwork.WALKING_METERS_PER_SECOND) + TransitNetworkBuilder.WALK_TRANSFER_EXTRA_TIME.value();
        assertThat(route.legs().get(1).rideTime().value()).isEqualTo(walkSeconds);
        assertThat(route.transferCount()).isEqualTo(1);
        assertThat(travelSeconds(mixed.reachableStops(DESTINATION, new Seconds(3600), 2)).get("X"))
                .isEqualTo(route.totalTime().value());
    }

    @Test
    @DisplayName("100m보다 멀리 떨어진 정류장끼리는 걸어서 갈아타지 않는다")
    void doesNotWalkToFarStop() {
        TransitNetwork mixed = busAndSubway(stop("P", 37.5100, 127.0300), stop("R", 37.5112, 127.0300));

        assertThat(mixed.route("X", DESTINATION, new Seconds(3600), 2)).isEmpty();
        assertThat(travelSeconds(mixed.reachableStops(DESTINATION, new Seconds(3600), 2))).doesNotContainKey("X");
    }

    @Test
    @DisplayName("걸어서 갈아탄 뒤에 다시 걸어서 갈아타지 않는다")
    void doesNotChainWalkTransfers() {
        // P-Q, Q-R은 100m 안이지만 P-R은 100m보다 멀다.
        TransitNetwork chained = new TransitNetwork(
                List.of(A, stop("X", 37.5400, 127.0300), stop("P", 37.5100, 127.0300), stop("Q", 37.5108, 127.0300),
                        stop("R", 37.5116, 127.0300)),
                List.of(route("B1", 3, 120), route("S1", 1, 120)),
                List.of(edge("B1", "X", "P", 300), edge("S1", "R", "A", 400)),
                List.of());

        assertThat(chained.route("X", DESTINATION, new Seconds(3600), 2)).isEmpty();
        assertThat(travelSeconds(chained.reachableStops(DESTINATION, new Seconds(3600), 2))).doesNotContainKey("X");
    }

    @Test
    @DisplayName("걸어서 갈아탄 뒤에 목적지까지 이어서 걷지 않는다")
    void doesNotWalkToDestinationAfterWalkTransfer() {
        // Q는 목적지에서 걸어서 10분 안이고 P는 아니다. P와 Q는 100m 안이다.
        TransitNetwork walking = new TransitNetwork(
                List.of(stop("X", 37.5400, 127.0000), stop("P", 37.5070, 127.0000), stop("Q", 37.5062, 127.0000)),
                List.of(route("B1", 3, 120)),
                List.of(edge("B1", "X", "P", 300)),
                List.of());

        assertThat(walking.route("X", DESTINATION, new Seconds(3600), 2)).isEmpty();
        assertThat(travelSeconds(walking.reachableStops(DESTINATION, new Seconds(3600), 2)))
                .containsOnlyKeys("Q");
    }

    // 버스 B1이 X에서 정류장 P까지, 지하철 S1이 역 R에서 도착 정류장 A까지 간다. P와 R 사이 GTFS 환승은 없다.
    private static TransitNetwork busAndSubway(final GtfsStop busStop, final GtfsStop station) {
        return new TransitNetwork(
                List.of(A, stop("X", 37.5400, 127.0300), busStop, station),
                List.of(route("B1", 3, 120), route("S1", 1, 120)),
                List.of(edge("B1", "X", busStop.stopId(), 300), edge("S1", station.stopId(), "A", 400)),
                List.of());
    }

    private static int walkSeconds(final Coordinate origin, final GtfsStop stop) {
        return (int) Math.ceil(origin.metersTo(stop.coordinate()) / TransitNetwork.WALKING_METERS_PER_SECOND);
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
