package com.jachwisunbae.transit.domain;

import com.jachwisunbae.transit.domain.vo.Coordinate;

// GTFS stops.txt의 한 정류장이다. 행정동 경계가 적재되어 있으면 정류장이 속한 행정동 코드를 함께 갖는다.
public record GtfsStop(String stopId, String stopName, Coordinate coordinate, String adminDongCode) {

    public GtfsStop(final String stopId, final String stopName, final Coordinate coordinate) {
        this(stopId, stopName, coordinate, null);
    }

    public GtfsStop withAdminDongCode(final String newAdminDongCode) {
        return new GtfsStop(stopId, stopName, coordinate, newAdminDongCode);
    }
}
