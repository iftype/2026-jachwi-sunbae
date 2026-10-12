package com.jachwisunbae.transit.controller.dto.response;

import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.ReachableStop;

public record CommuteStationResponse(String stopId, String stopName, double latitude, double longitude,
                                     int travelMinutes, String direction) {

    public static CommuteStationResponse from(final ReachableStop reachableStop) {
        GtfsStop stop = reachableStop.stop();
        return new CommuteStationResponse(stop.stopId(), stop.stopName(), stop.coordinate().latitude(),
                stop.coordinate().longitude(), reachableStop.travelMinutes(), reachableStop.direction());
    }
}
