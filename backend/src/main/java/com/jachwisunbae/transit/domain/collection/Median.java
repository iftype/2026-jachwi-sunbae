package com.jachwisunbae.transit.domain.collection;

import java.util.Arrays;

// 구간 이동 시간과 운행 간격이 같은 중앙값 정의를 쓰도록 한곳에서 계산한다.
// 짝수 개면 가운데 두 값의 평균을 반올림한다.
public final class Median {

    private Median() {
    }

    public static int of(final int[] values) {
        if (values.length == 0) {
            throw new IllegalArgumentException("중앙값을 구할 값이 없습니다.");
        }
        int[] sorted = values.clone();
        Arrays.sort(sorted);
        int middle = sorted.length / 2;
        if (sorted.length % 2 == 1) {
            return sorted[middle];
        }
        return (int) Math.round((sorted[middle - 1] + sorted[middle]) / 2.0);
    }
}
