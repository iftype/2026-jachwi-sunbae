package com.jachwisunbae.transit.domain.network;

// 노선망 탐색에서 큐에서 꺼낸 상태를 처리한다. false를 돌려주면 탐색을 멈춘다.
@FunctionalInterface
interface StateVisitor {

    boolean visit(int state, int seconds);
}
