package com.jachwisunbae.transit.domain.collection;

import com.jachwisunbae.transit.domain.GtfsEdge;
import com.jachwisunbae.transit.domain.GtfsRoute;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.GtfsTransfer;
import com.jachwisunbae.transit.domain.ReachableStop;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import com.jachwisunbae.transit.domain.vo.Seconds;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;

// 전국 노선망에서 목적지까지 제한 시간 안에 갈 수 있는 정류장을 찾는다.
// 목적지에서 출발해 구간을 거꾸로 따라가며, 정류장마다 목적지까지 가장 짧은 통근 시간을 구한다(다익스트라).
// 정류장 21만 개, 구간 117만 개를 다루므로 정류장과 노선을 번호로 바꿔 배열에 담는다.
public final class TransitNetwork {

    public static final double WALKING_METERS_PER_SECOND = 1.2;
    public static final Seconds MAX_ARRIVAL_WALK_TIME = new Seconds(600);

    private static final int RAIL_ROUTE_TYPE = 1;
    private static final int TRANSFER = -1;
    private static final String[] COMPASS = {"북", "북동", "동", "남동", "남", "남서", "서", "북서"};

    private final List<GtfsStop> stops;
    private final Map<String, Integer> stopIndexes;
    private final int[] waitSeconds;
    private final boolean[] railStops;

    // 정류장 i에 도착하는 구간·환승은 incoming[incomingStart[i] .. incomingStart[i + 1]) 이다.
    private final int[] incomingStart;
    private final int[] incomingFrom;
    private final int[] incomingRoute;
    private final int[] incomingSeconds;

    // 정류장 i에서 출발하는 구간의 다음 정류장은 next[nextStart[i] .. nextStart[i + 1]) 이다. 방향 계산에만 쓴다.
    private final int[] nextStart;
    private final int[] nextStops;

    public TransitNetwork(final List<GtfsStop> stops, final List<GtfsRoute> routes,
                          final List<GtfsEdge> edges, final List<GtfsTransfer> transfers) {
        this.stops = List.copyOf(stops);
        this.stopIndexes = indexStops(this.stops);
        Map<String, Integer> routeIndexes = new HashMap<>();
        this.waitSeconds = new int[routes.size()];
        boolean[] railRoutes = new boolean[routes.size()];
        for (int route = 0; route < routes.size(); route++) {
            routeIndexes.put(routes.get(route).routeId(), route);
            waitSeconds[route] = routes.get(route).waitTime().value();
            railRoutes[route] = routes.get(route).routeType() == RAIL_ROUTE_TYPE;
        }

        int linkCount = edges.size() + transfers.size();
        int[] from = new int[linkCount];
        int[] to = new int[linkCount];
        int[] route = new int[linkCount];
        int[] seconds = new int[linkCount];
        this.railStops = new boolean[this.stops.size()];
        for (int i = 0; i < edges.size(); i++) {
            GtfsEdge edge = edges.get(i);
            from[i] = stopIndex(edge.fromStopId());
            to[i] = stopIndex(edge.toStopId());
            route[i] = routeIndex(routeIndexes, edge.routeId());
            seconds[i] = edge.travelTime().value();
            if (railRoutes[route[i]]) {
                railStops[from[i]] = true;
                railStops[to[i]] = true;
            }
        }
        for (int i = 0; i < transfers.size(); i++) {
            GtfsTransfer transfer = transfers.get(i);
            int link = edges.size() + i;
            from[link] = stopIndex(transfer.fromStopId());
            to[link] = stopIndex(transfer.toStopId());
            route[link] = TRANSFER;
            seconds[link] = transfer.transferTime().value();
        }

        this.incomingStart = groupStart(to, linkCount);
        int[] incomingOrder = groupOrder(to, incomingStart, linkCount);
        this.incomingFrom = pick(from, incomingOrder);
        this.incomingRoute = pick(route, incomingOrder);
        this.incomingSeconds = pick(seconds, incomingOrder);

        this.nextStart = groupStart(from, edges.size());
        this.nextStops = pick(to, groupOrder(from, nextStart, edges.size()));
    }

    public boolean hasArrivalStop(final Coordinate destination) {
        return !arrivalWalkSeconds(destination).isEmpty();
    }

    // 목적지에서 걸어서 10분 안의 정류장을 도착 정류장으로 보고, 그곳까지 거꾸로 탐색한다.
    // 노선에 탈 때마다 그 노선의 대기 시간을 더하고, 환승 횟수(탑승 횟수 - 1)가 maxTransfers를 넘는 경로는 버린다.
    public List<ReachableStop> reachableStops(final Coordinate destination, final Seconds limit,
                                              final int maxTransfers) {
        Map<State, Integer> stateSeconds = new HashMap<>();
        int[] bestSeconds = new int[stops.size()];
        Arrays.fill(bestSeconds, Integer.MAX_VALUE);
        PriorityQueue<QueueEntry> queue = new PriorityQueue<>(Comparator.comparingInt(QueueEntry::seconds));

        arrivalWalkSeconds(destination).forEach((stop, seconds) -> {
            if (seconds <= limit.value()) {
                State state = new State(stop, TRANSFER, 0);
                stateSeconds.put(state, seconds);
                bestSeconds[stop] = Math.min(bestSeconds[stop], seconds);
                queue.add(new QueueEntry(state, seconds));
            }
        });

        while (!queue.isEmpty()) {
            QueueEntry current = queue.poll();
            State state = current.state();
            if (current.seconds() != stateSeconds.get(state)) {
                continue;
            }
            for (int link = incomingStart[state.stop()]; link < incomingStart[state.stop() + 1]; link++) {
                int route = incomingRoute[link];
                boolean boarding = route != TRANSFER && route != state.route();
                int boardings = state.boardings() + (boarding ? 1 : 0);
                if (boardings - 1 > maxTransfers) {
                    continue;
                }
                int seconds = current.seconds() + incomingSeconds[link] + (boarding ? waitSeconds[route] : 0);
                State next = new State(incomingFrom[link], route, boardings);
                if (seconds <= limit.value() && seconds < stateSeconds.getOrDefault(next, Integer.MAX_VALUE)) {
                    stateSeconds.put(next, seconds);
                    bestSeconds[next.stop()] = Math.min(bestSeconds[next.stop()], seconds);
                    queue.add(new QueueEntry(next, seconds));
                }
            }
        }
        return toReachableStops(bestSeconds);
    }

    private Map<Integer, Integer> arrivalWalkSeconds(final Coordinate destination) {
        Map<Integer, Integer> walkSeconds = new HashMap<>();
        for (int stop = 0; stop < stops.size(); stop++) {
            double meters = destination.metersTo(stops.get(stop).coordinate());
            int seconds = (int) Math.ceil(meters / WALKING_METERS_PER_SECOND);
            if (seconds <= MAX_ARRIVAL_WALK_TIME.value()) {
                walkSeconds.put(stop, seconds);
            }
        }
        return walkSeconds;
    }

    private List<ReachableStop> toReachableStops(final int[] bestSeconds) {
        List<ReachableStop> reachableStops = new ArrayList<>();
        for (int stop = 0; stop < stops.size(); stop++) {
            if (bestSeconds[stop] != Integer.MAX_VALUE) {
                reachableStops.add(new ReachableStop(stops.get(stop), new Seconds(bestSeconds[stop]),
                        direction(stop)));
            }
        }
        reachableStops.sort(Comparator.comparingInt((ReachableStop stop) -> stop.travelTime().value())
                .thenComparing(stop -> stop.stop().stopName())
                .thenComparing(stop -> stop.stop().stopId()));
        return reachableStops;
    }

    // 다음 정류장들로 향하는 단위 벡터를 더해 8방위로 바꾼다.
    // 역은 양방향 승강장을 한 정류장으로 쓰므로 방향을 두지 않는다.
    private String direction(final int stop) {
        if (railStops[stop]) {
            return null;
        }
        Coordinate from = stops.get(stop).coordinate();
        double east = 0;
        double north = 0;
        for (int i = nextStart[stop]; i < nextStart[stop + 1]; i++) {
            Coordinate to = stops.get(nextStops[i]).coordinate();
            double stepEast = (to.longitude() - from.longitude()) * Math.cos(Math.toRadians(from.latitude()));
            double stepNorth = to.latitude() - from.latitude();
            double length = Math.hypot(stepEast, stepNorth);
            if (length > 0) {
                east += stepEast / length;
                north += stepNorth / length;
            }
        }
        if (Math.hypot(east, north) < 0.01) {
            return null;
        }
        double bearing = (Math.toDegrees(Math.atan2(east, north)) + 360) % 360;
        return COMPASS[(int) Math.round(bearing / 45.0) % COMPASS.length];
    }

    private int stopIndex(final String stopId) {
        Integer index = stopIndexes.get(stopId);
        if (index == null) {
            throw new IllegalArgumentException("노선망에 없는 정류장입니다. stopId=" + stopId);
        }
        return index;
    }

    private static int routeIndex(final Map<String, Integer> routeIndexes, final String routeId) {
        Integer index = routeIndexes.get(routeId);
        if (index == null) {
            throw new IllegalArgumentException("노선망에 없는 노선입니다. routeId=" + routeId);
        }
        return index;
    }

    private static Map<String, Integer> indexStops(final List<GtfsStop> stops) {
        Map<String, Integer> indexes = new HashMap<>();
        for (int i = 0; i < stops.size(); i++) {
            indexes.put(stops.get(i).stopId(), i);
        }
        return indexes;
    }

    // keys[0 .. count)를 정류장 번호로 묶었을 때 각 정류장 묶음이 시작하는 위치다.
    private int[] groupStart(final int[] keys, final int count) {
        int[] start = new int[stops.size() + 1];
        for (int i = 0; i < count; i++) {
            start[keys[i] + 1]++;
        }
        for (int stop = 0; stop < stops.size(); stop++) {
            start[stop + 1] += start[stop];
        }
        return start;
    }

    private static int[] groupOrder(final int[] keys, final int[] start, final int count) {
        int[] cursor = Arrays.copyOf(start, start.length);
        int[] order = new int[count];
        for (int i = 0; i < count; i++) {
            order[cursor[keys[i]]++] = i;
        }
        return order;
    }

    private static int[] pick(final int[] values, final int[] order) {
        int[] picked = new int[order.length];
        for (int i = 0; i < order.length; i++) {
            picked[i] = values[order[i]];
        }
        return picked;
    }

    // route는 이 정류장에서 목적지 쪽으로 타고 가는 노선이다. 걸어서 이어지면 TRANSFER다.
    private record State(int stop, int route, int boardings) {
    }

    private record QueueEntry(State state, int seconds) {
    }
}
