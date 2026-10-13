package com.jachwisunbae.transit.domain;

import java.util.List;

// 목적지까지 갈 수 있는 정류장을 행정동 코드로 묶은 동네다. 행정동 이름과 경계는 클라이언트가 코드로 찾는다.
// 정류장은 통근 시간이 짧은 순서이고, 동네의 통근 시간은 그중 가장 짧은 시간이다.
public record CommuteArea(String adminDongCode, List<ReachableStop> stations) {

    public CommuteArea {
        if (adminDongCode == null || adminDongCode.isBlank()) {
            throw new IllegalArgumentException("동네에는 행정동 코드가 필요합니다.");
        }
        if (stations == null || stations.isEmpty()) {
            throw new IllegalArgumentException("동네에는 정류장이 하나 이상 있어야 합니다. code=" + adminDongCode);
        }
        stations = List.copyOf(stations);
    }

    public int commuteMinutes() {
        return stations.getFirst().travelMinutes();
    }
}
