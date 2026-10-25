package com.jachwisunbae.transit.domain.network.search;

import java.util.Arrays;

// 정류장별로 묶은 연결(구간·환승) 목록이다. 정류장 s의 연결 번호는 start(s) 이상 end(s) 미만이다.
// 들어오는 연결과 나가는 연결을 각각 하나씩 만들며, 연결 번호는 만든 목록 안에서만 의미가 있다.
// 117만 개 연결을 객체 없이 다루려고 안쪽은 원시 배열로 둔다.
public final class StopLinks {

    // 걸어서 갈아타는 연결의 노선 번호다.
    public static final int TRANSFER = -1;

    private final int[] start;
    private final int[] other;
    private final int[] route;
    private final int[] seconds;

    private StopLinks(final int[] start, final int[] other, final int[] route, final int[] seconds) {
        this.start = start;
        this.other = other;
        this.route = route;
        this.seconds = seconds;
    }

    // 연결 count개를 group 쪽 정류장으로 묶는다. other는 연결 반대편 정류장이다.
    // 나가는 연결은 출발 정류장으로, 들어오는 연결은 도착 정류장으로 묶는다.
    public static StopLinks groupBy(final int stopCount, final int count, final int[] group, final int[] other,
                             final int[] route, final int[] seconds) {
        int[] start = groupStart(stopCount, count, group);
        int[] order = groupOrder(count, group, start);
        return new StopLinks(start, pick(other, order), pick(route, order), pick(seconds, order));
    }

    public int start(final int stop) {
        return start[stop];
    }

    public int end(final int stop) {
        return start[stop + 1];
    }

    // 연결 반대편 정류장이다. 나가는 연결이면 도착 정류장, 들어오는 연결이면 출발 정류장이다.
    public int other(final int link) {
        return other[link];
    }

    public int route(final int link) {
        return route[link];
    }

    public int seconds(final int link) {
        return seconds[link];
    }

    public boolean isTransfer(final int link) {
        return route[link] == TRANSFER;
    }

    // 정류장마다 연결 수를 센 뒤 누적해, 정류장 묶음이 시작하는 위치를 구한다.
    private static int[] groupStart(final int stopCount, final int count, final int[] group) {
        int[] start = new int[stopCount + 1];
        for (int i = 0; i < count; i++) {
            start[group[i] + 1]++;
        }
        for (int stop = 0; stop < stopCount; stop++) {
            start[stop + 1] += start[stop];
        }
        return start;
    }

    // 묶은 뒤 i번째 자리에 들어갈 원래 연결 번호다.
    private static int[] groupOrder(final int count, final int[] group, final int[] start) {
        int[] cursor = Arrays.copyOf(start, start.length);
        int[] order = new int[count];
        for (int i = 0; i < count; i++) {
            order[cursor[group[i]]++] = i;
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
}
