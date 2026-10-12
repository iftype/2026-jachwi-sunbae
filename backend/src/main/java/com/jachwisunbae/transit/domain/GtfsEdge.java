package com.jachwisunbae.transit.domain;

import com.jachwisunbae.transit.domain.vo.Seconds;

// 같은 노선에서 연속한 두 정류장 사이의 이동 시간이다.
public record GtfsEdge(String routeId, String fromStopId, String toStopId, Seconds travelTime) {
}
