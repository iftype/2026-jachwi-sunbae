package com.jachwisunbae.transit.domain.collection;

import com.jachwisunbae.transit.domain.vo.Seconds;
import java.util.Arrays;

// 같은 구간을 지나는 운행마다 이동 시간이 달라 중앙값을 대표 이동 시간으로 쓴다.
public class TravelTimeSamples {

    private int[] values = new int[4];
    private int size;

    public void add(final Seconds travelTime) {
        if (size == values.length) {
            values = Arrays.copyOf(values, values.length * 2);
        }
        values[size++] = travelTime.value();
    }

    public Seconds median() {
        return new Seconds(Median.of(Arrays.copyOf(values, size)));
    }
}
