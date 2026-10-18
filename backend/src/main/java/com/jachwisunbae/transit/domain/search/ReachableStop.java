package com.jachwisunbae.transit.domain.search;

import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.vo.Seconds;

// 목적지까지 제한 시간 안에 갈 수 있는 정류장이다.
// 통근 시간은 대기·환승 시간과 도착 정류장에서 목적지까지 걷는 시간을 포함한다.
// 방향은 버스 정류장에서 다음 정류장으로 가는 8방위이며, 역이나 방향을 정할 수 없는 정류장은 null이다.
public record ReachableStop(GtfsStop stop, Seconds travelTime, String direction) {

    public int travelMinutes() {
        return (travelTime.value() + 59) / 60;
    }

    public String adminDongCode() {
        return stop.adminDongCode();
    }
}
