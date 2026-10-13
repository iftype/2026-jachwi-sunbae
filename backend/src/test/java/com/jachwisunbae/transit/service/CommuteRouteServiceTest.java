package com.jachwisunbae.transit.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.common.exception.client.BusinessRuleViolationException;
import com.jachwisunbae.common.exception.client.ResourceNotFoundException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.transit.domain.CommuteRoute;
import com.jachwisunbae.transit.domain.GtfsEdge;
import com.jachwisunbae.transit.domain.GtfsFeed;
import com.jachwisunbae.transit.domain.GtfsRoute;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.RouteLeg;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import com.jachwisunbae.transit.domain.vo.Seconds;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CommuteRouteServiceTest {

    // 목적지 바로 옆 정류장 A로 버스 R1이 C → B → A 순서로 들어온다.
    private static final Coordinate DESTINATION = new Coordinate(37.5000, 127.0000);

    private final InMemoryGtfsNetworkRepository networkRepository = new InMemoryGtfsNetworkRepository();
    private final CommuteRouteService service = new CommuteRouteService(new TransitNetworkCache(new TransitNetworkLoader(networkRepository)));

    @BeforeEach
    void setUp() {
        networkRepository.replace(new GtfsFeed(
                List.of(new GtfsRoute("R1", "1", "1번", 3, new Seconds(120))),
                List.of(stop("A", 37.5000, 127.0010), stop("B", 37.5100, 127.0010), stop("C", 37.5200, 127.0010)),
                List.of(new GtfsEdge("R1", "C", "B", new Seconds(180)), new GtfsEdge("R1", "B", "A", new Seconds(180))),
                List.of()));
    }

    @Test
    @DisplayName("정류장에서 목적지까지 타고 갈 노선과 걷는 구간을 찾는다")
    void findsRoute() {
        CommuteRoute route = service.findRoute("C", DESTINATION, 60, 2);

        assertThat(route.legs()).extracting(RouteLeg::type).containsExactly(RouteLeg.Type.BUS, RouteLeg.Type.WALK);
        assertThat(route.legs().getFirst().routeName()).isEqualTo("1");
    }

    @Test
    @DisplayName("노선망에 없는 정류장이면 찾을 수 없다고 알린다")
    void failsWhenStopIsUnknown() {
        assertThatThrownBy(() -> service.findRoute("NONE", DESTINATION, 60, 2))
                .isInstanceOf(ResourceNotFoundException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.TRANSIT_STOP_NOT_FOUND);
    }

    @Test
    @DisplayName("목적지에서 걸어서 10분 안에 정류장이 없으면 경로를 찾지 않는다")
    void failsWhenNoArrivalStop() {
        assertThatThrownBy(() -> service.findRoute("C", new Coordinate(35.1, 129.0), 60, 2))
                .isInstanceOf(BusinessRuleViolationException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.COMMUTE_DESTINATION_UNREACHABLE);
    }

    @Test
    @DisplayName("최대 통근 시간 안에 경로가 없으면 찾을 수 없다고 알린다")
    void failsWhenRouteIsOverLimit() {
        assertThatThrownBy(() -> service.findRoute("C", DESTINATION, 5, 2))
                .isInstanceOf(ResourceNotFoundException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.COMMUTE_ROUTE_NOT_FOUND);
    }

    private static GtfsStop stop(final String stopId, final double latitude, final double longitude) {
        return new GtfsStop(stopId, stopId + " 정류장", new Coordinate(latitude, longitude));
    }
}
