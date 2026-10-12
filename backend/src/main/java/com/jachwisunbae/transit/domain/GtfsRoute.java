package com.jachwisunbae.transit.domain;

import com.jachwisunbae.transit.domain.vo.Seconds;

// GTFS routes.txt의 한 노선이다. 탑승 대기 시간은 운행 간격으로 계산해 채운다.
public record GtfsRoute(String routeId, String shortName, String longName, int routeType, Seconds waitTime) {

    public static final Seconds DEFAULT_WAIT_TIME = new Seconds(300);

    public GtfsRoute withWaitTime(final Seconds newWaitTime) {
        return new GtfsRoute(routeId, shortName, longName, routeType, newWaitTime);
    }
}
