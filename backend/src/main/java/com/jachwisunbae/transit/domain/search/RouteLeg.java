package com.jachwisunbae.transit.domain.search;

import com.jachwisunbae.transit.domain.vo.Seconds;
import java.util.List;

// 경로에서 한 노선을 타고 가거나 걸어가는 한 구간이다.
// points는 지나는 정류장을 차례로 담고, 마지막 도보 구간은 목적지로 끝난다.
// 대기 시간은 노선에 탈 때 기다리는 시간이며, 도보 구간은 0이다.
public record RouteLeg(Type type, String routeName, List<RoutePoint> points, Seconds rideTime, Seconds waitTime) {

    public enum Type {
        BUS, SUBWAY, WALK
    }

    public RouteLeg {
        if (points == null || points.size() < 2) {
            throw new IllegalArgumentException("구간에는 출발과 도착 지점이 있어야 합니다.");
        }
        points = List.copyOf(points);
    }

    public int rideMinutes() {
        return (rideTime.value() + 59) / 60;
    }

    public int waitMinutes() {
        return (waitTime.value() + 59) / 60;
    }
}
