package com.jachwisunbae.transit.domain;

import java.util.List;

// 경로 탐색에 쓰도록 GTFS 원본을 정리한 결과다.
public record GtfsFeed(List<GtfsRoute> routes, List<GtfsStop> stops,
                       List<GtfsEdge> edges, List<GtfsTransfer> transfers) {
}
