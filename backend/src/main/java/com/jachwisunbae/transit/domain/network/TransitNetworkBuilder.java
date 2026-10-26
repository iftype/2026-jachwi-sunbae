package com.jachwisunbae.transit.domain.network;

import static com.jachwisunbae.transit.domain.network.search.StopLinks.TRANSFER;

import com.jachwisunbae.transit.domain.GtfsEdge;
import com.jachwisunbae.transit.domain.GtfsRoute;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.GtfsTransfer;
import com.jachwisunbae.transit.domain.network.search.SearchStates;
import com.jachwisunbae.transit.domain.network.search.StopGrid;
import com.jachwisunbae.transit.domain.network.search.StopLinks;
import com.jachwisunbae.transit.domain.vo.Seconds;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

// 구간과 환승을 한 개씩 받아 노선망을 만든다. 117만 개 구간을 목록으로 모으지 않고 DB에서 읽는 대로 번호 배열에 담는다.
// 정류장 번호는 stops 목록의 위치이고, 노선 번호는 routes 목록의 위치다.
public final class TransitNetworkBuilder {

    private static final int INITIAL_CAPACITY = 1 << 16;

    private final List<GtfsStop> stops;
    private final Map<String, Integer> stopIndexes = new HashMap<>();
    private final List<GtfsRoute> routes;
    private final Map<String, Integer> routeIndexes = new HashMap<>();

    // 받은 순서대로 쌓은 연결이다. i번째 연결은 from[i]에서 to[i]로 route[i] 노선을 타고 seconds[i]초 걸린다.
    private int[] from = new int[INITIAL_CAPACITY];
    private int[] to = new int[INITIAL_CAPACITY];
    private int[] route = new int[INITIAL_CAPACITY];
    private int[] seconds = new int[INITIAL_CAPACITY];
    private int size;

    TransitNetworkBuilder(final List<GtfsStop> stops, final List<GtfsRoute> routes) {
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
        add(stopIndex(transfer.fromStopId()), stopIndex(transfer.toStopId()), TRANSFER, transfer.transferTime());
    }

    // 받은 연결을 정류장별로 묶는다. 생활권 탐색은 들어오는 연결을, 경로 안내는 나가는 연결을 쓴다.
    public TransitNetwork build() {
        StopLinks incoming = StopLinks.groupBy(stops.size(), size, to, from, route, seconds);
        StopLinks outgoing = StopLinks.groupBy(stops.size(), size, from, to, route, seconds);
        return new TransitNetwork(stops, stopIndexes, routes, incoming, outgoing, new StopGrid(stops));
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
