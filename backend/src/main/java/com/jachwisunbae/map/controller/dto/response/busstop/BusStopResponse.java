package com.jachwisunbae.map.controller.dto.response.busstop;

import com.jachwisunbae.map.domain.busstop.BusStop;
import com.jachwisunbae.map.service.dto.result.busstop.BusStopResult;
import java.math.BigDecimal;

// nodeId는 국토교통부 정류장 ID다. 길 건너 양방향 정류장처럼 이름이 같아도 nodeId가 다르면 다른 정류장이다.
public record BusStopResponse(String nodeId, String name, BigDecimal latitude, BigDecimal longitude,
                              int distanceMeters) {

    public static BusStopResponse from(BusStopResult result) {
        BusStop busStop = result.busStop();
        return new BusStopResponse(busStop.getNodeId(), busStop.getName(), busStop.getLatitude(),
                busStop.getLongitude(), result.distanceMeters());
    }
}
