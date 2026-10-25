package com.jachwisunbae.transit.domain.network.search;

import com.jachwisunbae.transit.domain.vo.Seconds;
import java.util.Map;

// 경로 안내에서 걷는 시간까지 더해 가장 빨리 목적지에 닿은 상태를 기록한다.
// 꺼낸 상태가 이미 찾은 도착보다 늦으면 더 빠른 경로가 나올 수 없으므로 탐색을 멈춘다.
public final class RouteArrival {

    private final SearchStates states;
    private final Map<Integer, Integer> walkSeconds;
    private final Seconds limit;
    private int state = SearchStates.NONE;
    private int seconds = Integer.MAX_VALUE;

    public RouteArrival(final SearchStates states, final Map<Integer, Integer> walkSeconds, final Seconds limit) {
        this.states = states;
        this.walkSeconds = walkSeconds;
        this.limit = limit;
    }

    public boolean visit(final int candidate, final int current) {
        if (current >= seconds) {
            return false;
        }
        Integer walk = walkSeconds.get(states.stop(candidate));
        if (walk != null && current + walk <= limit.value() && current + walk < seconds) {
            state = candidate;
            seconds = current + walk;
        }
        return true;
    }

    public int state() {
        return state;
    }

    public int seconds() {
        return seconds;
    }
}
