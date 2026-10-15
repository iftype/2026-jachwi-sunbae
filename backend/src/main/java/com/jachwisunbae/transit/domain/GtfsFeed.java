package com.jachwisunbae.transit.domain;

import java.util.List;
import java.util.Set;
import java.util.function.Predicate;
import java.util.stream.Collectors;

// 경로 탐색에 쓰도록 GTFS 원본을 정리한 결과다.
public record GtfsFeed(List<GtfsRoute> routes, List<GtfsStop> stops, List<GtfsEdge> edges,
                       List<GtfsTransfer> transfers) {

    // 조건에 맞는 정류장만 남긴다. 구간과 환승은 양쪽 정류장이 모두 남을 때만, 노선은 남은 구간이 있을 때만 남긴다.
    public GtfsFeed retainStops(final Predicate<GtfsStop> condition) {
        List<GtfsStop> retainedStops = stops.stream().filter(condition).toList();
        Set<String> stopIds = retainedStops.stream().map(GtfsStop::stopId).collect(Collectors.toSet());
        List<GtfsEdge> retainedEdges = edges.stream()
                .filter(edge -> stopIds.contains(edge.fromStopId()) && stopIds.contains(edge.toStopId()))
                .toList();
        Set<String> routeIds = retainedEdges.stream().map(GtfsEdge::routeId).collect(Collectors.toSet());
        return new GtfsFeed(
                routes.stream().filter(route -> routeIds.contains(route.routeId())).toList(),
                retainedStops,
                retainedEdges,
                transfers.stream()
                        .filter(transfer -> stopIds.contains(transfer.fromStopId())
                                && stopIds.contains(transfer.toStopId()))
                        .toList());
    }
}
