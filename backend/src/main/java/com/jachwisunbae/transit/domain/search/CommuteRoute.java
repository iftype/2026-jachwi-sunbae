package com.jachwisunbae.transit.domain.search;

import com.jachwisunbae.transit.domain.vo.Seconds;
import java.util.List;

// 정류장 하나에서 목적지까지의 경로다. 통근 시간은 생활권 탐색의 정류장 통근 시간과 같은 규칙으로 계산한다.
public record CommuteRoute(Seconds totalTime, int transferCount, List<RouteLeg> legs) {

    public CommuteRoute {
        legs = List.copyOf(legs);
    }

    public int totalMinutes() {
        return (totalTime.value() + 59) / 60;
    }
}
