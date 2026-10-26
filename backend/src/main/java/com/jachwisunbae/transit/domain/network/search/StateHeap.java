package com.jachwisunbae.transit.domain.network.search;

import java.util.Arrays;

// 탐색 상태 번호를 시간이 짧은 순서로 꺼내는 이진 힙이다. 객체를 만들지 않도록 상태 번호와 시간을 원시 배열에 담는다.
// 같은 상태가 더 짧은 시간으로 다시 들어오면 그대로 하나 더 넣고, 꺼낼 때 오래된 항목을 건너뛴다.
public final class StateHeap {

    private int[] states = new int[1 << 12];
    private int[] seconds = new int[1 << 12];
    private int size;

    public boolean isEmpty() {
        return size == 0;
    }

    public int topState() {
        return states[0];
    }

    public int topSeconds() {
        return seconds[0];
    }

    public void push(final int state, final int time) {
        if (size == states.length) {
            states = Arrays.copyOf(states, size * 2);
            seconds = Arrays.copyOf(seconds, size * 2);
        }
        int child = size++;
        while (child > 0) {
            int parent = (child - 1) / 2;
            if (seconds[parent] <= time) {
                break;
            }
            states[child] = states[parent];
            seconds[child] = seconds[parent];
            child = parent;
        }
        states[child] = state;
        seconds[child] = time;
    }

    public void removeTop() {
        size--;
        if (size == 0) {
            return;
        }
        int lastState = states[size];
        int lastSeconds = seconds[size];
        int parent = 0;
        while (true) {
            int child = parent * 2 + 1;
            if (child >= size) {
                break;
            }
            if (child + 1 < size && seconds[child + 1] < seconds[child]) {
                child++;
            }
            if (seconds[child] >= lastSeconds) {
                break;
            }
            states[parent] = states[child];
            seconds[parent] = seconds[child];
            parent = child;
        }
        states[parent] = lastState;
        seconds[parent] = lastSeconds;
    }
}
