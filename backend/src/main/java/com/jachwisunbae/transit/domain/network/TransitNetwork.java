package com.jachwisunbae.transit.domain.network;

import static com.jachwisunbae.transit.domain.network.search.StopLinks.TRANSFER;

import com.jachwisunbae.transit.domain.CommuteRoute;
import com.jachwisunbae.transit.domain.GtfsEdge;
import com.jachwisunbae.transit.domain.GtfsRoute;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.GtfsTransfer;
import com.jachwisunbae.transit.domain.ReachableStop;
import com.jachwisunbae.transit.domain.RouteLeg;
import com.jachwisunbae.transit.domain.RoutePoint;
import com.jachwisunbae.transit.domain.network.search.RouteArrival;
import com.jachwisunbae.transit.domain.network.search.RouteStep;
import com.jachwisunbae.transit.domain.network.search.SearchStates;
import com.jachwisunbae.transit.domain.network.search.StateHeap;
import com.jachwisunbae.transit.domain.network.search.StopGrid;
import com.jachwisunbae.transit.domain.network.search.StopLinks;
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
// 정류장 21만 개, 구간 117만 개를 다루므로 정류장과 노선을 번호로 바꾸고(TransitNetworkBuilder),
// 연결은 정류장별로 묶은 StopLinks에, 탐색 상태는 객체 없이 SearchStates·StateHeap의 원시 배열에 담는다.
public final class TransitNetwork {

    public static final double WALKING_METERS_PER_SECOND = 1.2;
    public static final Seconds MAX_ARRIVAL_WALK_TIME = new Seconds(600);

    private static final int RAIL_ROUTE_TYPE = 1;

    private final List<GtfsStop> stops;
    private final Map<String, Integer> stopIndexes;
    private final List<GtfsRoute> routes;
    private final int[] waitSeconds;
    private final boolean[] railRoutes;
    private final StopGrid stopGrid;

    // 생활권 탐색은 목적지에서 거꾸로 가므로 들어오는 연결을, 경로 안내는 나가는 연결을 쓴다.
    // 두 목록의 연결 번호는 서로 다르므로 섞어 쓰지 않는다.
    private final StopLinks incoming;
    private final StopLinks outgoing;

    public TransitNetwork(final List<GtfsStop> stops, final List<GtfsRoute> routes,
                          final List<GtfsEdge> edges, final List<GtfsTransfer> transfers) {
        this(collect(stops, routes, edges, transfers).build());
    }

    private TransitNetwork(final TransitNetwork network) {
        this(network.stops, network.stopIndexes, network.routes, network.incoming, network.outgoing,
                network.stopGrid);
    }

    TransitNetwork(final List<GtfsStop> stops, final Map<String, Integer> stopIndexes, final List<GtfsRoute> routes,
                   final StopLinks incoming, final StopLinks outgoing, final StopGrid stopGrid) {
        this.stops = stops;
        this.stopIndexes = stopIndexes;
        this.routes = routes;
        this.incoming = incoming;
        this.outgoing = outgoing;
        this.stopGrid = stopGrid;
        this.waitSeconds = new int[routes.size()];
        this.railRoutes = new boolean[routes.size()];
        for (int route = 0; route < routes.size(); route++) {
            waitSeconds[route] = routes.get(route).waitTime().value();
            railRoutes[route] = routes.get(route).routeType() == RAIL_ROUTE_TYPE;
        }
    }

    public static TransitNetworkBuilder builder(final List<GtfsStop> stops, final List<GtfsRoute> routes) {
        return new TransitNetworkBuilder(stops, routes);
    }

    private static TransitNetworkBuilder collect(final List<GtfsStop> stops, final List<GtfsRoute> routes,
                                                 final List<GtfsEdge> edges, final List<GtfsTransfer> transfers) {
        TransitNetworkBuilder builder = builder(stops, routes);
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

    // 목적지에서 걸어서 10분 안의 정류장을 도착 정류장으로 보고, 그곳에서 들어오는 연결을 거꾸로 따라간다.
    public List<ReachableStop> reachableStops(final Coordinate destination, final Seconds limit,
                                              final int maxTransfers) {
        return toReachableStops(bestSeconds(destination, limit, maxTransfers));
    }

    // 출발지마다 목적지까지 걸리는 가장 짧은 시간이다. 목적지에서 한 번만 거꾸로 탐색한 뒤,
    // 출발지에서 걸어서 10분 안의 정류장마다 걷는 시간을 더해 고른다. 목적지까지 걸어서 10분 안이면 걷는 시간도 후보다.
    // 제한 시간 안에 닿지 못하는 출발지는 비워 둔다.
    public List<Optional<Seconds>> travelTimes(final Coordinate destination, final List<Coordinate> origins,
                                               final Seconds limit, final int maxTransfers) {
        int[] bestSeconds = bestSeconds(destination, limit, maxTransfers);
        return origins.stream().map(origin -> travelTime(origin, destination, bestSeconds, limit)).toList();
    }

    private Optional<Seconds> travelTime(final Coordinate origin, final Coordinate destination,
                                         final int[] bestSeconds, final Seconds limit) {
        int directWalkSeconds = walkSeconds(origin, destination);
        int[] best = {directWalkSeconds <= MAX_ARRIVAL_WALK_TIME.value() ? directWalkSeconds : Integer.MAX_VALUE};
        stopGrid.forEachNear(origin, stop -> {
            int walkSeconds = walkSeconds(origin, stops.get(stop).coordinate());
            if (walkSeconds <= MAX_ARRIVAL_WALK_TIME.value() && bestSeconds[stop] != Integer.MAX_VALUE) {
                best[0] = Math.min(best[0], walkSeconds + bestSeconds[stop]);
            }
        });
        if (best[0] > limit.value()) {
            return Optional.empty();
        }
        return Optional.of(new Seconds(best[0]));
    }

    private int[] bestSeconds(final Coordinate destination, final Seconds limit, final int maxTransfers) {
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

        search(incoming, states, heap, limit, maxTransfers, bestSeconds, null);
        return bestSeconds;
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

        RouteArrival arrival = new RouteArrival(states, walkSeconds, limit);
        search(outgoing, states, heap, limit, maxTransfers, null, arrival);
        if (arrival.state() == SearchStates.NONE) {
            return Optional.empty();
        }
        int arrivalStop = states.stop(arrival.state());
        List<RouteLeg> legs = toLegs(arrival.state(), states);
        int finalWalkSeconds = walkSeconds.get(arrivalStop);
        if (finalWalkSeconds > 0) {
            legs.add(new RouteLeg(RouteLeg.Type.WALK, null,
                    List.of(point(arrivalStop), RoutePoint.destination(destination)),
                    new Seconds(finalWalkSeconds), new Seconds(0)));
        }
        return Optional.of(new CommuteRoute(new Seconds(arrival.seconds()),
                Math.max(0, states.boardings(arrival.state()) - 1), legs));
    }

    // 생활권 탐색과 경로 안내가 함께 쓰는 다익스트라다. 두 탐색은 쓰는 연결 목록(들어오는·나가는 연결)과
    // 기록하는 값만 다르고 규칙은 같다. 생활권 탐색은 정류장별 최단 시간을 bestSeconds에,
    // 경로 안내는 가장 빠른 도착을 arrival에 기록한다. 쓰지 않는 쪽은 null로 넘긴다.
    // 노선에 탈 때마다 그 노선의 대기 시간을 더하고, 환승 횟수(탑승 횟수 - 1)가 maxTransfers를 넘거나
    // 제한 시간을 넘는 경로는 버린다. 상태마다 직전 상태와 따라온 연결을 기록한다.
    private void search(final StopLinks links, final SearchStates states, final StateHeap heap, final Seconds limit,
                        final int maxTransfers, final int[] bestSeconds, final RouteArrival arrival) {
        while (!heap.isEmpty()) {
            int state = heap.topState();
            int current = heap.topSeconds();
            heap.removeTop();
            if (current != states.seconds(state)) {
                continue;
            }
            int currentRoute = states.route(state);
            boolean walked = walked(states, state, arrival != null);
            if (arrival != null && !arrival.visit(state, current, walked)) {
                return;
            }
            int stop = states.stop(state);
            int currentBoardings = states.boardings(state);
            for (int link = links.start(stop); link < links.end(stop); link++) {
                int route = links.route(link);
                if (route == TRANSFER && walked) {
                    continue;
                }
                boolean boarding = route != TRANSFER && route != currentRoute;
                int boardings = currentBoardings + (boarding ? 1 : 0);
                if (boardings - 1 > maxTransfers) {
                    continue;
                }
                int wait = boarding ? waitSeconds[route] : 0;
                int seconds = current + links.seconds(link) + wait;
                if (seconds > limit.value()) {
                    continue;
                }
                int nextStop = links.other(link);
                int next = states.findOrInsert(SearchStates.key(nextStop, route, boardings));
                if (seconds < states.seconds(next)) {
                    states.update(next, seconds, state, link, wait);
                    if (bestSeconds != null) {
                        bestSeconds[nextStop] = Math.min(bestSeconds[nextStop], seconds);
                    }
                    heap.push(next, seconds);
                }
            }
        }
    }

    // 걷기는 이어 붙이지 않는다. 걸어서 온 상태에서는 다시 도보 환승하거나 목적지까지 걷지 않는다.
    // 걸어서 온 상태는 도보 환승으로 온 상태와, 생활권 탐색에서 목적지에서 도착 정류장까지 걸어온 시작 상태다.
    // 경로 안내의 출발 정류장은 걸어온 것이 아니므로 바로 도보 환승하거나 목적지까지 걸을 수 있다.
    private static boolean walked(final SearchStates states, final int state, final boolean forward) {
        if (states.route(state) != TRANSFER) {
            return false;
        }
        return !forward || states.previous(state) != SearchStates.NONE;
    }

    // 도착한 상태에서 지나온 구간을 거꾸로 따라간 뒤, 같은 노선으로 이어진 구간과 이어진 도보 환승을 하나로 묶는다.
    private List<RouteLeg> toLegs(final int arrival, final SearchStates states) {
        List<RouteStep> steps = new ArrayList<>();
        for (int state = arrival; states.previous(state) != SearchStates.NONE; state = states.previous(state)) {
            steps.add(new RouteStep(states.stop(states.previous(state)), states.link(state),
                    states.waitSeconds(state)));
        }
        Collections.reverse(steps);

        List<RouteLeg> legs = new ArrayList<>();
        int start = 0;
        while (start < steps.size()) {
            int route = outgoing.route(steps.get(start).link());
            int end = start;
            while (end + 1 < steps.size() && outgoing.route(steps.get(end + 1).link()) == route) {
                end++;
            }
            legs.add(toLeg(steps.subList(start, end + 1), route));
            start = end + 1;
        }
        return legs;
    }

    private RouteLeg toLeg(final List<RouteStep> steps, final int route) {
        List<RoutePoint> points = new ArrayList<>();
        points.add(point(steps.getFirst().fromStop()));
        int rideSeconds = 0;
        int waitSecondsOfLeg = 0;
        for (RouteStep step : steps) {
            points.add(point(outgoing.other(step.link())));
            rideSeconds += outgoing.seconds(step.link());
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
            int seconds = walkSeconds(destination, stops.get(stop).coordinate());
            if (seconds <= MAX_ARRIVAL_WALK_TIME.value()) {
                walkSeconds.put(stop, seconds);
            }
        });
        return walkSeconds;
    }

    private static int walkSeconds(final Coordinate from, final Coordinate to) {
        return (int) Math.ceil(from.metersTo(to) / WALKING_METERS_PER_SECOND);
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
                reachableStops.add(new ReachableStop(stops.get(stop), new Seconds(bestSeconds[stop])));
            }
        }
        reachableStops.sort(Comparator.comparingInt((ReachableStop stop) -> stop.travelTime().value())
                .thenComparing(stop -> stop.stop().stopName())
                .thenComparing(stop -> stop.stop().stopId()));
        return reachableStops;
    }

    private int stopIndex(final String stopId) {
        Integer index = stopIndexes.get(stopId);
        if (index == null) {
            throw new IllegalArgumentException("노선망에 없는 정류장입니다. stopId=" + stopId);
        }
        return index;
    }
}
