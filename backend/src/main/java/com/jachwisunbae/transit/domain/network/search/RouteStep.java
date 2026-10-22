package com.jachwisunbae.transit.domain.network.search;

// 경로 안내에서 지나온 구간·환승 하나다. fromStop에서 나가는 연결 link를 따라갔고, 탈 때 waitSeconds를 기다렸다.
public record RouteStep(int fromStop, int link, int waitSeconds) {
}
