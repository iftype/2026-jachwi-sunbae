package com.jachwisunbae.map.service.dto.result.busstop;

import com.jachwisunbae.map.domain.busstop.BusStop;

// 기준 좌표에서 정류장까지의 거리(m)를 함께 담는다.
public record BusStopResult(BusStop busStop, int distanceMeters) {
}
