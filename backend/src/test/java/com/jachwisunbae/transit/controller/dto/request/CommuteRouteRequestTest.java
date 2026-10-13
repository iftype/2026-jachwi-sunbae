package com.jachwisunbae.transit.controller.dto.request;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CommuteRouteRequestTest {

    @Test
    @DisplayName("최대 통근 시간과 최대 환승 횟수를 비우면 생활권 탐색과 같은 기본값 60분, 2회를 쓴다")
    void usesDefaults() {
        CommuteRouteRequest request = new CommuteRouteRequest(37.5, 127.0, "S1", null, null);

        assertThat(request.maxMinutes()).isEqualTo(60);
        assertThat(request.maxTransfers()).isEqualTo(2);
    }
}
