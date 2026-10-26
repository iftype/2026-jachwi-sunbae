package com.jachwisunbae.transit.controller.dto.response;

import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.ReachableStop;

// direction(정류장 방향)은 사용을 중단했다(POL-COMMUTE-016). 기존 클라이언트의 응답 파싱이 깨지지 않도록
// 필드는 남겨 두고 항상 null을 보낸다.
public record CommuteStationResponse(String stopId, String stopName, double latitude, double longitude,
                                     int travelMinutes, String direction) {

    public static CommuteStationResponse from(final ReachableStop reachableStop) {
        GtfsStop stop = reachableStop.stop();
        return new CommuteStationResponse(stop.stopId(), stop.stopName(), stop.coordinate().latitude(),
                stop.coordinate().longitude(), reachableStop.travelMinutes(), null);
    }
}
