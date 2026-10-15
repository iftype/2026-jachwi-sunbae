package com.jachwisunbae.map.controller.dto.response.busstop;

import com.jachwisunbae.map.service.dto.result.busstop.BusStopsResult;
import java.math.BigDecimal;
import java.util.List;

public record BusStopsResponse(Center center, int radius, int count, List<BusStopResponse> busStops) {

    public static BusStopsResponse from(BusStopsResult result) {
        List<BusStopResponse> busStops = result.busStops().stream().map(BusStopResponse::from).toList();
        return new BusStopsResponse(new Center(result.latitude(), result.longitude()), result.radius(),
                busStops.size(), busStops);
    }

    public record Center(BigDecimal latitude, BigDecimal longitude) {
    }
}
