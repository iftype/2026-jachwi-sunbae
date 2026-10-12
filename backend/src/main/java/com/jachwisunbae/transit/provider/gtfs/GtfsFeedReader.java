package com.jachwisunbae.transit.provider.gtfs;

import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.InternalSystemException;
import com.jachwisunbae.transit.domain.GtfsFeed;
import com.jachwisunbae.transit.domain.GtfsRoute;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.GtfsTransfer;
import com.jachwisunbae.transit.provider.gtfs.aggregation.StopTimeAccumulator;
import java.io.UncheckedIOException;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

// KTDB(국가교통DB) GTFS 디렉터리를 읽어 버스·지하철 노선망으로 정리한다. 어떤 행을 적재할지는 여기서 판단한다.
@Component
public class GtfsFeedReader {

    // route_type 1은 지하철·도시철도, 3은 GTFS 표준 버스이고 KTDB 데이터는 버스에 0도 쓴다. 2(일반철도) 등은 뺀다.
    private static final Set<String> TRANSIT_ROUTE_TYPES = Set.of("0", "1", "3");
    // GTFS transfer_type 3은 환승할 수 없는 정류장 쌍이다.
    private static final String TRANSFER_NOT_POSSIBLE = "3";

    public GtfsFeed read(final Path directory) {
        try {
            return read(new GtfsFiles(directory));
        } catch (UncheckedIOException exception) {
            throw new InternalSystemException(ErrorCode.TRANSIT_FEED_READ_FAILURE,
                    "GTFS 파일을 읽지 못했습니다. directory=" + directory, exception.getCause());
        }
    }

    private GtfsFeed read(final GtfsFiles files) {
        List<GtfsRoute> routes = files.read("routes.txt", this::isTransitRoute, GtfsRecord::toRoute);
        StopTimeAccumulator stopTimes = accumulateStopTimes(files, routeIdsByTrip(files, routes));
        Set<String> usedStopIds = stopTimes.usedStopIds();

        List<GtfsRoute> routesWithWaitTime = routes.stream()
                .map(route -> route.withWaitTime(stopTimes.waitTimeOf(route.routeId())))
                .toList();
        List<GtfsStop> stops = files.read("stops.txt",
                record -> usedStopIds.contains(record.text("stop_id")), GtfsRecord::toStop);
        List<GtfsTransfer> transfers = shortestPerStopPair(files.read("transfers.txt",
                record -> isUsableTransfer(record, usedStopIds), GtfsRecord::toTransfer));
        return new GtfsFeed(routesWithWaitTime, stops, stopTimes.medianEdges(), transfers);
    }

    private boolean isTransitRoute(final GtfsRecord record) {
        return TRANSIT_ROUTE_TYPES.contains(record.text("route_type"));
    }

    // 대상 노선의 운행편만 trip_id → route_id로 기억한다.
    private Map<String, String> routeIdsByTrip(final GtfsFiles files, final List<GtfsRoute> routes) {
        Set<String> routeIds = routes.stream()
                .map(GtfsRoute::routeId)
                .collect(Collectors.toSet());
        Map<String, String> routeIdsByTrip = new HashMap<>();
        files.forEach("trips.txt", record -> {
            String routeId = record.text("route_id");
            if (routeIds.contains(routeId)) {
                routeIdsByTrip.put(record.text("trip_id"), routeId);
            }
        });
        return routeIdsByTrip;
    }

    private StopTimeAccumulator accumulateStopTimes(final GtfsFiles files, final Map<String, String> routeIdsByTrip) {
        StopTimeAccumulator accumulator = new StopTimeAccumulator();
        files.forEach("stop_times.txt", record -> {
            String routeId = routeIdsByTrip.get(record.text("trip_id"));
            if (routeId != null) {
                accumulator.add(routeId, record);
            }
        });
        return accumulator;
    }

    // 양쪽 정류장이 모두 적재 대상이어야 한다.
    // 환승 불가(3)이거나, 0·1처럼 최소 환승 시간이 비어 있을 수 있는 유형은 걸리는 시간을 알 수 없어 쓰지 않는다.
    private boolean isUsableTransfer(final GtfsRecord record, final Set<String> usedStopIds) {
        return usedStopIds.contains(record.text("from_stop_id"))
                && usedStopIds.contains(record.text("to_stop_id"))
                && !TRANSFER_NOT_POSSIBLE.equals(record.optionalText("transfer_type"))
                && !record.optionalText("min_transfer_time").isBlank();
    }

    // transfers.txt에 같은 정류장 쌍이 여러 번 나오면 가장 짧은 환승 시간을 남긴다.
    private List<GtfsTransfer> shortestPerStopPair(final List<GtfsTransfer> transfers) {
        Map<List<String>, GtfsTransfer> transfersByStopPair = new LinkedHashMap<>();
        transfers.forEach(transfer -> transfersByStopPair.merge(
                List.of(transfer.fromStopId(), transfer.toStopId()), transfer, GtfsFeedReader::shorter));
        return List.copyOf(transfersByStopPair.values());
    }

    private static GtfsTransfer shorter(final GtfsTransfer current, final GtfsTransfer candidate) {
        if (candidate.transferTime().value() < current.transferTime().value()) {
            return candidate;
        }
        return current;
    }
}
