package com.jachwisunbae.transit.domain.network.search;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class StateHeapTest {

    @Test
    @DisplayName("넣은 순서와 상관없이 시간이 짧은 상태부터 꺼낸다")
    void popsShortestFirst() {
        StateHeap heap = new StateHeap();
        Random random = new Random(1);
        for (int state = 0; state < 10_000; state++) {
            heap.push(state, random.nextInt(3_600));
        }

        List<Integer> seconds = new ArrayList<>();
        while (!heap.isEmpty()) {
            seconds.add(heap.topSeconds());
            heap.removeTop();
        }

        assertThat(seconds).hasSize(10_000).isSorted();
    }
}
