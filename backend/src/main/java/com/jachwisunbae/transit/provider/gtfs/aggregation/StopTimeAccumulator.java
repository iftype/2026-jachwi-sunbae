package com.jachwisunbae.transit.provider.gtfs.aggregation;

import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.InternalSystemException;
import com.jachwisunbae.transit.domain.GtfsEdge;
import com.jachwisunbae.transit.domain.GtfsRoute;
import com.jachwisunbae.transit.domain.collection.DepartureSchedule;
import com.jachwisunbae.transit.domain.collection.TravelTimeSamples;
import com.jachwisunbae.transit.domain.vo.Seconds;
import com.jachwisunbae.transit.provider.gtfs.GtfsRecord;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

// stop_times.txt를 한 번 읽으며 바로 앞 정차와 비교해 다음 세 가지를 모은다.
// - 대상 노선이 정차한 정류장
// - 구간(노선, 출발 정류장, 도착 정류장)별 이동 시간 표본
// - 노선별 운행편 첫 정류장 출발 시각
// GTFS 표준은 행 순서를 보장하지 않으므로, 운행편 행이 모여 있고 stop_sequence가 증가한다는 전제가 깨지면
// 틀린 구간을 만드는 대신 적재를 멈춘다.
public class StopTimeAccumulator {

    // 시각표상 같은 분에 도착하는 구간도 실제로는 이동 시간이 있으므로 최소 30초로 본다.
    private static final int MINIMUM_TRAVEL_SECONDS = 30;

    private final Set<String> usedStopIds = new HashSet<>();
    private final Map<EdgeKey, TravelTimeSamples> travelTimesByEdge = new LinkedHashMap<>();
    private final Map<String, List<Integer>> departuresByRoute = new HashMap<>();
    private final Set<String> startedTripIds = new HashSet<>();

    private String previousTripId;
    private String previousStopId;
    private int previousArrivalSeconds;
    private int previousStopSequence;

    public void add(final String routeId, final GtfsRecord record) {
        String tripId = record.text("trip_id");
        String stopId = record.text("stop_id");
        int stopSequence = record.integer("stop_sequence");
        int arrivalSeconds = record.seconds("arrival_time");

        if (tripId.equals(previousTripId)) {
            requireIncreasing(tripId, stopSequence);
            if (!stopId.equals(previousStopId)) {
                addTravelTime(routeId, stopId, arrivalSeconds);
            }
        } else {
            startTrip(routeId, tripId, record.seconds("departure_time"));
        }

        usedStopIds.add(stopId);
        previousTripId = tripId;
        previousStopId = stopId;
        previousArrivalSeconds = arrivalSeconds;
        previousStopSequence = stopSequence;
    }

    public Set<String> usedStopIds() {
        return Collections.unmodifiableSet(usedStopIds);
    }

    // 같은 구간을 지나는 운행마다 이동 시간이 달라 중앙값을 대표 이동 시간으로 쓴다.
    public List<GtfsEdge> medianEdges() {
        List<GtfsEdge> edges = new ArrayList<>(travelTimesByEdge.size());
        travelTimesByEdge.forEach((edge, samples) ->
                edges.add(new GtfsEdge(edge.routeId(), edge.fromStopId(), edge.toStopId(), samples.median())));
        return edges;
    }

    public Seconds waitTimeOf(final String routeId) {
        List<Integer> departures = departuresByRoute.get(routeId);
        if (departures == null) {
            return GtfsRoute.DEFAULT_WAIT_TIME;
        }
        return new DepartureSchedule(departures).waitTime();
    }

    private void startTrip(final String routeId, final String tripId, final int departureSeconds) {
        if (!startedTripIds.add(tripId)) {
            throw unordered("운행편의 정차 기록이 한곳에 모여 있지 않습니다. trip_id=" + tripId);
        }
        departuresByRoute.computeIfAbsent(routeId, ignored -> new ArrayList<>()).add(departureSeconds);
    }

    private void requireIncreasing(final String tripId, final int stopSequence) {
        if (stopSequence <= previousStopSequence) {
            throw unordered("stop_sequence가 증가하지 않습니다. trip_id=" + tripId
                    + ", " + previousStopSequence + " -> " + stopSequence);
        }
    }

    private void addTravelTime(final String routeId, final String stopId, final int arrivalSeconds) {
        int travelSeconds = Math.max(MINIMUM_TRAVEL_SECONDS, arrivalSeconds - previousArrivalSeconds);
        travelTimesByEdge.computeIfAbsent(new EdgeKey(routeId, previousStopId, stopId),
                        ignored -> new TravelTimeSamples())
                .add(new Seconds(travelSeconds));
    }

    private InternalSystemException unordered(final String detail) {
        return new InternalSystemException(ErrorCode.TRANSIT_FEED_READ_FAILURE,
                "stop_times.txt 정렬 전제가 깨졌습니다. " + detail);
    }

    private record EdgeKey(String routeId, String fromStopId, String toStopId) {
    }
}
