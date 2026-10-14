package com.jachwisunbae.transit.domain;

import com.jachwisunbae.transit.domain.vo.Coordinate;

// 경로가 지나는 지점이다. 정류장이면 정류장 ID와 이름을, 목적지면 ID 없이 "목적지"를 갖는다.
public record RoutePoint(String stopId, String name, Coordinate coordinate) {

    private static final String DESTINATION_NAME = "목적지";

    public static RoutePoint of(final GtfsStop stop) {
        return new RoutePoint(stop.stopId(), stop.stopName(), stop.coordinate());
    }

    public static RoutePoint destination(final Coordinate coordinate) {
        return new RoutePoint(null, DESTINATION_NAME, coordinate);
    }
}
