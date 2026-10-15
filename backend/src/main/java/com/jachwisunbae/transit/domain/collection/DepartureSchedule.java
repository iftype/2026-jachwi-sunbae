package com.jachwisunbae.transit.domain.collection;

import com.jachwisunbae.transit.domain.vo.Seconds;
import java.util.List;
import java.util.stream.IntStream;

// 노선의 첫 정류장 출발 시각으로 평균 탑승 대기 시간을 추정한다.
// 대기 시간은 운행 간격 중앙값의 절반이며, 1분 미만·2시간 초과 간격은 이상값으로 보고 제외한다.
// 같은 시각에 출발하는 운행편끼리의 0초 간격도 1분 미만 규칙으로 제외된다.
public class DepartureSchedule {

    private static final int MINIMUM_GAP_SECONDS = 60;
    private static final int MAXIMUM_GAP_SECONDS = 7200;
    private static final int DEFAULT_HEADWAY_SECONDS = 600;
    private static final int MINIMUM_WAIT_SECONDS = 120;
    private static final int MAXIMUM_WAIT_SECONDS = 900;

    private final List<Integer> departureSeconds;

    public DepartureSchedule(final List<Integer> departureSeconds) {
        this.departureSeconds = departureSeconds;
    }

    public Seconds waitTime() {
        int[] gaps = gaps();
        int medianHeadway = gaps.length == 0 ? DEFAULT_HEADWAY_SECONDS : Median.of(gaps);
        return new Seconds(Math.max(MINIMUM_WAIT_SECONDS, Math.min(MAXIMUM_WAIT_SECONDS, medianHeadway / 2)));
    }

    private int[] gaps() {
        List<Integer> sorted = departureSeconds.stream().sorted().toList();
        return IntStream.range(1, sorted.size())
                .map(index -> sorted.get(index) - sorted.get(index - 1))
                .filter(gap -> gap >= MINIMUM_GAP_SECONDS && gap <= MAXIMUM_GAP_SECONDS)
                .toArray();
    }
}
