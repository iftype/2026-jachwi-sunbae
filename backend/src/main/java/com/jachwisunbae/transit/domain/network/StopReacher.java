package com.jachwisunbae.transit.domain.network;

// 노선망 탐색에서 더 짧은 시간으로 정류장에 닿았을 때 할 일이다.
@FunctionalInterface
interface StopReacher {

    void reach(int stop, int seconds);
}
