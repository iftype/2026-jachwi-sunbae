package com.jachwisunbae.transit.domain.collection;

import com.jachwisunbae.transit.domain.CommuteRoute;
import com.jachwisunbae.transit.domain.GtfsEdge;
import com.jachwisunbae.transit.domain.GtfsRoute;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.GtfsTransfer;
import com.jachwisunbae.transit.domain.ReachableStop;
import com.jachwisunbae.transit.domain.RouteLeg;
import com.jachwisunbae.transit.domain.RoutePoint;
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
import java.util.PriorityQueue;

// 전국 노선망에서 목적지까지 제한 시간 안에 갈 수 있는 정류장과, 정류장 하나에서 목적지까지의 경로를 찾는다.
// 생활권 탐색은 목적지에서 출발해 구간을 거꾸로 따라가며 정류장마다 가장 짧은 통근 시간을 구하고(다익스트라),
// 경로 안내는 같은 규칙으로 출발 정류장에서 목적지 쪽으로 따라가며 지나온 구간을 기록한다.
// 정류장 21만 개, 구간 117만 개를 다루므로 정류장과 노선을 번호로 바꿔 배열에 담는다.
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
        this.stops = List.copyOf(stops);
        this.stopIndexes = indexStops(this.stops);
        this.routes = List.copyOf(routes);
        Map<String, Integer> routeIndexes = new HashMap<>();
        this.waitSeconds = new int[routes.size()];
        this.railRoutes = new boolean[routes.size()];
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

        this.outgoingStart = groupStart(from, linkCount);
        int[] outgoingOrder = groupOrder(from, outgoingStart, linkCount);
        this.outgoingTo = pick(to, outgoingOrder);
        this.outgoingRoute = pick(route, outgoingOrder);
        this.outgoingSeconds = pick(seconds, outgoingOrder);
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

    // 출발 정류장에서 목적지 쪽으로 생활권 탐색과 같은 규칙(대기 시간, 최대 환승 횟수, 도착 정류장 도보)으로 따라가,
    // 걷는 시간까지 더해 가장 빨리 목적지에 닿는 경로를 찾는다. 같은 규칙이므로 생활권 탐색의 통근 시간과 같다.
    public Optional<CommuteRoute> route(final String originStopId, final Coordinate destination, final Seconds limit,
                                        final int maxTransfers) {
        Map<Integer, Integer> walkSeconds = arrivalWalkSeconds(destination);
        Map<State, Integer> stateSeconds = new HashMap<>();
        Map<State, Step> previousSteps = new HashMap<>();
        PriorityQueue<QueueEntry> queue = new PriorityQueue<>(Comparator.comparingInt(QueueEntry::seconds));
        State origin = new State(stopIndex(originStopId), TRANSFER, 0);
        stateSeconds.put(origin, 0);
        queue.add(new QueueEntry(origin, 0));

        State arrival = null;
        int bestSeconds = Integer.MAX_VALUE;
        while (!queue.isEmpty()) {
            QueueEntry current = queue.poll();
            State state = current.state();
            if (current.seconds() != stateSeconds.get(state)) {
                continue;
            }
            if (current.seconds() >= bestSeconds) {
                break;
            }
            Integer walk = walkSeconds.get(state.stop());
            if (walk != null && current.seconds() + walk <= limit.value() && current.seconds() + walk < bestSeconds) {
                arrival = state;
                bestSeconds = current.seconds() + walk;
            }
            for (int link = outgoingStart[state.stop()]; link < outgoingStart[state.stop() + 1]; link++) {
                int route = outgoingRoute[link];
                boolean boarding = route != TRANSFER && route != state.route();
                int boardings = state.boardings() + (boarding ? 1 : 0);
                if (boardings - 1 > maxTransfers) {
                    continue;
                }
                int wait = boarding ? waitSeconds[route] : 0;
                int seconds = current.seconds() + outgoingSeconds[link] + wait;
                State next = new State(outgoingTo[link], route, boardings);
                if (seconds <= limit.value() && seconds < stateSeconds.getOrDefault(next, Integer.MAX_VALUE)) {
                    stateSeconds.put(next, seconds);
                    previousSteps.put(next, new Step(state, link, wait));
                    queue.add(new QueueEntry(next, seconds));
                }
            }
        }
        if (arrival == null) {
            return Optional.empty();
        }
        List<RouteLeg> legs = toLegs(arrival, previousSteps);
        int finalWalkSeconds = walkSeconds.get(arrival.stop());
        if (finalWalkSeconds > 0) {
            legs.add(new RouteLeg(RouteLeg.Type.WALK, null,
                    List.of(point(arrival.stop()), RoutePoint.destination(destination)),
                    new Seconds(finalWalkSeconds), new Seconds(0)));
        }
        return Optional.of(new CommuteRoute(new Seconds(bestSeconds), Math.max(0, arrival.boardings() - 1), legs));
    }

    // 도착한 상태에서 지나온 구간을 거꾸로 따라간 뒤, 같은 노선으로 이어진 구간과 이어진 도보 환승을 하나로 묶는다.
    private List<RouteLeg> toLegs(final State arrival, final Map<State, Step> previousSteps) {
        List<Step> steps = new ArrayList<>();
        for (State state = arrival; previousSteps.containsKey(state); state = previousSteps.get(state).from()) {
            steps.add(previousSteps.get(state));
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
        points.add(point(steps.getFirst().from().stop()));
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

    // 경로 안내에서 state에 오기 직전 상태와 지나온 구간·환승이다.
    private record Step(State from, int link, int waitSeconds) {
    }
}
