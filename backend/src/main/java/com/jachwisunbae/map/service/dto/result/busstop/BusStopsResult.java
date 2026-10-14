package com.jachwisunbae.map.service.dto.result.busstop;

import java.math.BigDecimal;
import java.util.List;

public record BusStopsResult(BigDecimal latitude, BigDecimal longitude, int radius, List<BusStopResult> busStops) {
}
