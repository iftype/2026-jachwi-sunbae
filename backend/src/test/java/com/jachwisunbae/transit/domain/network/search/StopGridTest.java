package com.jachwisunbae.transit.domain.network.search;

import static org.assertj.core.api.Assertions.assertThat;

import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class StopGridTest {

    @Test
    @DisplayName("격자 칸 경계 너머라도 720m 안의 정류장은 모두 후보로 돌려준다")
    void findsStopsAcrossCellBoundary() {
        Coordinate destination = new Coordinate(37.50001, 127.00001);
        List<GtfsStop> stops = List.of(
                stop("north", 37.5064, 127.00001),
                stop("west", 37.50001, 126.9920),
                stop("far", 37.53, 127.00001));
        List<String> found = new ArrayList<>();

        new StopGrid(stops).forEachNear(destination, stop -> found.add(stops.get(stop).stopId()));

        assertThat(destination.metersTo(stops.get(0).coordinate())).isLessThan(720);
        assertThat(destination.metersTo(stops.get(1).coordinate())).isLessThan(720);
        assertThat(found).contains("north", "west").doesNotContain("far");
    }

    private static GtfsStop stop(final String stopId, final double latitude, final double longitude) {
        return new GtfsStop(stopId, stopId, new Coordinate(latitude, longitude));
    }
}
