package com.jachwisunbae.transit.domain.search;

import com.jachwisunbae.transit.domain.GtfsEdge;
import com.jachwisunbae.transit.domain.GtfsRoute;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.GtfsTransfer;
import com.jachwisunbae.transit.domain.search.CommuteRoute;
import com.jachwisunbae.transit.domain.search.ReachableStop;
import com.jachwisunbae.transit.domain.search.RouteLeg;
import com.jachwisunbae.transit.domain.search.RoutePoint;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import com.jachwisunbae.transit.domain.vo.Seconds;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

// 전국 노선망에서 목적지까지 제한 시간 안에 갈 수 있는 정류장과, 정류장 하나에서 목적지까지의 경로를 찾는다.
// 생활권 탐색은 목적지에서 출발해 구간을 거꾸로 따라가며 정류장마다 가장 짧은 통근 시간을 구하고(다익스트라),
// 경로 안내는 같은 규칙으로 출발 정류장에서 목적지 쪽으로 따라가며 지나온 구간을 기록한다.
// 정류장 21만 개, 구간 117만 개를 다루므로 정류장과 노선을 번호로 바꿔 배열에 담고,
// 탐색 상태도 객체 없이 SearchStates·StateHeap의 원시 배열로 다룬다.
public final class TransitNetwork {

    public static final double WALKING_METERS_PER_SECOND = 1.2;
    public static final Seconds MAX_ARRIVAL_WALK_TIME = new Seconds(600);

    private static final int RAIL_ROUTE_TYPE = 1;
    private static final int TRANSFER = -1;
    private static final String[] COMPASS = {"북", "북동", "동", "남동", "남", "남서", "서", "북서"};

    private final List<GtfsStop> stops;
    private final Map<String, Integer> stopIndexes;
    private final List<GtfsRoute> routes;
    private final int[] waitSeconds;
    private final boolean[] railRoutes;
    private final boolean[] railStops;
    private final StopGrid stopGrid;

    // 정류장 i에 도착하는 구간·환승은 incoming[incomingStart[i] .. incomingStart[i + 1]) 이다.
    private final int[] incomingStart;
    private final int[] incomingFrom;
    private final int[] incomingRoute;
    private final int[] incomingSeconds;

    // 정류장 i에서 출발하는 구간·환승은 outgoing[outgoingStart[i] .. outgoingStart[i + 1]) 이다.
    private final int[] outgoingStart;
    private final int[] outgoingTo;
    private final int[] outgoingRoute;
    private final int[] outgoingSeconds;

    public TransitNetwork(final List<GtfsStop> stops, final List<GtfsRoute> routes,
                          final List<GtfsEdge> edges, final List<GtfsTransfer> transfers) {
        this(collect(stops, routes, edges, transfers));
    }

    private TransitNetwork(final Builder builder) {
        this.stops = builder.stops;
        this.stopIndexes = builder.stopIndexes;
        this.routes = builder.routes;
        this.waitSeconds = new int[routes.size()];
        this.railRoutes = new boolean[routes.size()];
        for (int route = 0; route < routes.size(); route++) {
            waitSeconds[route] = routes.get(route).waitTime().value();
            railRoutes[route] = routes.get(route).routeType() == RAIL_ROUTE_TYPE;
        }

        int linkCount = builder.size;
        int[] from = builder.from;
        int[] to = builder.to;
        int[] route = builder.route;
        int[] seconds = builder.seconds;
        this.railStops = new boolean[stops.size()];
        for (int link = 0; link < linkCount; link++) {
            if (route[link] != TRANSFER && railRoutes[route[link]]) {
                railStops[from[link]] = true;
                railStops[to[link]] = true;
            }
        }

        this.incomingStart = groupStart(to, linkCount);
        int[] incomingOrder = groupOrder(to, incomingStart, linkCount);
        this.incomingFrom = pick(from, incomingOrder);
        this.incomingRoute = pick(route, incomingOrder);
        this.incomingSeconds = pick(seconds, incomingOrder);

        this.outgoingStart = groupStart(from, linkCount);
        int[] outgoingOrder = groupOrder(from, outgoingStart, linkCount);
        this.outgoingTo = pick(to, outgoingOrder);
        this.outgoingRoute = pick(route, outgoingOrder);
        this.outgoingSeconds = pick(seconds, outgoingOrder);
        this.stopGrid = new StopGrid(stops);
    }

    // 구간을 한 개씩 받아 노선망을 만든다. 117만 개 구간을 목록으로 모으지 않고 DB에서 읽는 대로 번호 배열에 담는다.
    public static Builder builder(final List<GtfsStop> stops, final List<GtfsRoute> routes) {
        return new Builder(stops, routes);
    }

    private static Builder collect(final List<GtfsStop> stops, final List<GtfsRoute> routes,
                                   final List<GtfsEdge> edges, final List<GtfsTransfer> transfers) {
        Builder builder = builder(stops, routes);
        edges.forEach(builder::addEdge);
        transfers.forEach(builder::addTransfer);
        return builder;
    }

    public boolean hasStop(final String stopId) {
        return stopIndexes.containsKey(stopId);
    }

    public boolean hasArrivalStop(final Coordinate destination) {
        return !arrivalWalkSeconds(destination).isEmpty();
    }

    // 목적지에서 걸어서 10분 안의 정류장을 도착 정류장으로 보고, 그곳까지 거꾸로 탐색한다.
    // 노선에 탈 때마다 그 노선의 대기 시간을 더하고, 환승 횟수(탑승 횟수 - 1)가 maxTransfers를 넘는 경로는 버린다.
    public List<ReachableStop> reachableStops(final Coordinate destination, final Seconds limit,
                                              final int maxTransfers) {
        validateTransfers(maxTransfers);
        SearchStates states = new SearchStates();
        StateHeap heap = new StateHeap();
        int[] bestSeconds = new int[stops.size()];
        Arrays.fill(bestSeconds, Integer.MAX_VALUE);

        arrivalWalkSeconds(destination).forEach((stop, seconds) -> {
            if (seconds <= limit.value()) {
                int state = states.findOrInsert(SearchStates.key(stop, TRANSFER, 0));
                states.update(state, seconds, SearchStates.NONE, SearchStates.NONE, 0);
                bestSeconds[stop] = Math.min(bestSeconds[stop], seconds);
                heap.push(state, seconds);
            }
        });

        while (!heap.isEmpty()) {
            int state = heap.topState();
            int current = heap.topSeconds();
            heap.removeTop();
            if (current != states.seconds(state)) {
                continue;
            }
            int stop = states.stop(state);
            int currentRoute = states.route(state);
            int currentBoardings = states.boardings(state);
            for (int link = incomingStart[stop]; link < incomingStart[stop + 1]; link++) {
                int route = incomingRoute[link];
                boolean boarding = route != TRANSFER && route != currentRoute;
                int boardings = currentBoardings + (boarding ? 1 : 0);
                if (boardings - 1 > maxTransfers) {
                    continue;
                }
                int seconds = current + incomingSeconds[link] + (boarding ? waitSeconds[route] : 0);
                if (seconds > limit.value()) {
                    continue;
                }
                int next = states.findOrInsert(SearchStates.key(incomingFrom[link], route, boardings));
                if (seconds < states.seconds(next)) {
                    states.update(next, seconds, SearchStates.NONE, SearchStates.NONE, 0);
                    bestSeconds[incomingFrom[link]] = Math.min(bestSeconds[incomingFrom[link]], seconds);
                    heap.push(next, seconds);
                }
            }
        }
        return toReachableStops(bestSeconds);
    }

    // 출발 정류장에서 목적지 쪽으로 생활권 탐색과 같은 규칙(대기 시간, 최대 환승 횟수, 도착 정류장 도보)으로 따라가,
    // 걷는 시간까지 더해 가장 빨리 목적지에 닿는 경로를 찾는다. 같은 규칙이므로 생활권 탐색의 통근 시간과 같다.
    public Optional<CommuteRoute> route(final String originStopId, final Coordinate destination, final Seconds limit,
                                        final int maxTransfers) {
        validateTransfers(maxTransfers);
        Map<Integer, Integer> walkSeconds = arrivalWalkSeconds(destination);
        SearchStates states = new SearchStates();
        StateHeap heap = new StateHeap();
        int origin = states.findOrInsert(SearchStates.key(stopIndex(originStopId), TRANSFER, 0));
        states.update(origin, 0, SearchStates.NONE, SearchStates.NONE, 0);
        heap.push(origin, 0);

        int arrival = SearchStates.NONE;
        int bestSeconds = Integer.MAX_VALUE;
        while (!heap.isEmpty()) {
            int state = heap.topState();
            int current = heap.topSeconds();
            heap.removeTop();
            if (current != states.seconds(state)) {
                continue;
            }
            if (current >= bestSeconds) {
                break;
            }
            int stop = states.stop(state);
            Integer walk = walkSeconds.get(stop);
            if (walk != null && current + walk <= limit.value() && current + walk < bestSeconds) {
                arrival = state;
                bestSeconds = current + walk;
            }
            int currentRoute = states.route(state);
            int currentBoardings = states.boardings(state);
            for (int link = outgoingStart[stop]; link < outgoingStart[stop + 1]; link++) {
                int route = outgoingRoute[link];
                boolean boarding = route != TRANSFER && route != currentRoute;
                int boardings = currentBoardings + (boarding ? 1 : 0);
                if (boardings - 1 > maxTransfers) {
                    continue;
                }
                int wait = boarding ? waitSeconds[route] : 0;
                int seconds = current + outgoingSeconds[link] + wait;
                if (seconds > limit.value()) {
                    continue;
                }
                int next = states.findOrInsert(SearchStates.key(outgoingTo[link], route, boardings));
                if (seconds < states.seconds(next)) {
                    states.update(next, seconds, state, link, wait);
                    heap.push(next, seconds);
                }
            }
        }
        if (arrival == SearchStates.NONE) {
            return Optional.empty();
        }
        int arrivalStop = states.stop(arrival);
        List<RouteLeg> legs = toLegs(arrival, states);
        int finalWalkSeconds = walkSeconds.get(arrivalStop);
        if (finalWalkSeconds > 0) {
            legs.add(new RouteLeg(RouteLeg.Type.WALK, null,
                    List.of(point(arrivalStop), RoutePoint.destination(destination)),
                    new Seconds(finalWalkSeconds), new Seconds(0)));
        }
        return Optional.of(new CommuteRoute(new Seconds(bestSeconds), Math.max(0, states.boardings(arrival) - 1),
                legs));
    }

    // 도착한 상태에서 지나온 구간을 거꾸로 따라간 뒤, 같은 노선으로 이어진 구간과 이어진 도보 환승을 하나로 묶는다.
    private List<RouteLeg> toLegs(final int arrival, final SearchStates states) {
        List<Step> steps = new ArrayList<>();
        for (int state = arrival; states.previous(state) != SearchStates.NONE; state = states.previous(state)) {
            steps.add(new Step(states.stop(states.previous(state)), states.link(state), states.waitSeconds(state)));
        }
        Collections.reverse(steps);

        List<RouteLeg> legs = new ArrayList<>();
        int start = 0;
        while (start < steps.size()) {
            int route = outgoingRoute[steps.get(start).link()];
            int end = start;
            while (end + 1 < steps.size() && outgoingRoute[steps.get(end + 1).link()] == route) {
                end++;
            }
            legs.add(toLeg(steps.subList(start, end + 1), route));
            start = end + 1;
        }
        return legs;
    }

    private RouteLeg toLeg(final List<Step> steps, final int route) {
        List<RoutePoint> points = new ArrayList<>();
        points.add(point(steps.getFirst().fromStop()));
        int rideSeconds = 0;
        int waitSecondsOfLeg = 0;
        for (Step step : steps) {
            points.add(point(outgoingTo[step.link()]));
            rideSeconds += outgoingSeconds[step.link()];
            waitSecondsOfLeg += step.waitSeconds();
        }
        if (route == TRANSFER) {
            return new RouteLeg(RouteLeg.Type.WALK, null, points, new Seconds(rideSeconds), new Seconds(0));
        }
        RouteLeg.Type type = railRoutes[route] ? RouteLeg.Type.SUBWAY : RouteLeg.Type.BUS;
        return new RouteLeg(type, routes.get(route).shortName(), points, new Seconds(rideSeconds),
                new Seconds(waitSecondsOfLeg));
    }

    private RoutePoint point(final int stop) {
        return RoutePoint.of(stops.get(stop));
    }

    private Map<Integer, Integer> arrivalWalkSeconds(final Coordinate destination) {
        Map<Integer, Integer> walkSeconds = new HashMap<>();
        stopGrid.forEachNear(destination, stop -> {
            double meters = destination.metersTo(stops.get(stop).coordinate());
            int seconds = (int) Math.ceil(meters / WALKING_METERS_PER_SECOND);
            if (seconds <= MAX_ARRIVAL_WALK_TIME.value()) {
                walkSeconds.put(stop, seconds);
            }
        });
        return walkSeconds;
    }

    private static void validateTransfers(final int maxTransfers) {
        if (maxTransfers < 0 || maxTransfers + 1 > SearchStates.MAX_BOARDINGS) {
            throw new IllegalArgumentException("최대 환승 횟수가 범위를 벗어났습니다. maxTransfers=" + maxTransfers);
        }
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
        for (int link = outgoingStart[stop]; link < outgoingStart[stop + 1]; link++) {
            if (outgoingRoute[link] == TRANSFER) {
                continue;
            }
            Coordinate to = stops.get(outgoingTo[link]).coordinate();
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

    public static final class Builder {

        private static final int INITIAL_CAPACITY = 1 << 16;

        private final List<GtfsStop> stops;
        private final Map<String, Integer> stopIndexes = new HashMap<>();
        private final List<GtfsRoute> routes;
        private final Map<String, Integer> routeIndexes = new HashMap<>();
        private int[] from = new int[INITIAL_CAPACITY];
        private int[] to = new int[INITIAL_CAPACITY];
        private int[] route = new int[INITIAL_CAPACITY];
        private int[] seconds = new int[INITIAL_CAPACITY];
        private int size;

        private Builder(final List<GtfsStop> stops, final List<GtfsRoute> routes) {
            if (routes.size() >= SearchStates.MAX_ROUTES) {
                throw new IllegalArgumentException("노선이 너무 많습니다. routes=" + routes.size());
            }
            this.stops = List.copyOf(stops);
            this.routes = List.copyOf(routes);
            for (int i = 0; i < this.stops.size(); i++) {
                stopIndexes.put(this.stops.get(i).stopId(), i);
            }
            for (int i = 0; i < this.routes.size(); i++) {
                routeIndexes.put(this.routes.get(i).routeId(), i);
            }
        }

        public void addEdge(final GtfsEdge edge) {
            Integer routeIndex = routeIndexes.get(edge.routeId());
            if (routeIndex == null) {
                throw new IllegalArgumentException("노선망에 없는 노선입니다. routeId=" + edge.routeId());
            }
            add(stopIndex(edge.fromStopId()), stopIndex(edge.toStopId()), routeIndex, edge.travelTime());
        }

        public void addTransfer(final GtfsTransfer transfer) {
            add(stopIndex(transfer.fromStopId()), stopIndex(transfer.toStopId()), TRANSFER,
                    transfer.transferTime());
        }

        public TransitNetwork build() {
            return new TransitNetwork(this);
        }

        private void add(final int fromStop, final int toStop, final int routeIndex, final Seconds time) {
            if (size == from.length) {
                from = Arrays.copyOf(from, size * 2);
                to = Arrays.copyOf(to, size * 2);
                route = Arrays.copyOf(route, size * 2);
                seconds = Arrays.copyOf(seconds, size * 2);
            }
            from[size] = fromStop;
            to[size] = toStop;
            route[size] = routeIndex;
            seconds[size] = time.value();
            size++;
        }

        private int stopIndex(final String stopId) {
            Integer index = stopIndexes.get(stopId);
            if (index == null) {
                throw new IllegalArgumentException("노선망에 없는 정류장입니다. stopId=" + stopId);
            }
            return index;
        }
    }

    // 경로 안내에서 지나온 구간·환승 하나다. fromStop에서 link를 따라갔고, 탈 때 waitSeconds를 기다렸다.
    private record Step(int fromStop, int link, int waitSeconds) {
    }
}
