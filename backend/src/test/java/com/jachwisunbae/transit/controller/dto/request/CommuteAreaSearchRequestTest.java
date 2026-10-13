package com.jachwisunbae.transit.controller.dto.request;

import static org.assertj.core.api.Assertions.assertThat;

import com.jachwisunbae.transit.domain.vo.Coordinate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CommuteAreaSearchRequestTest {

    @Test
    @DisplayName("최대 통근 시간과 최대 환승 횟수를 비우면 기본값 60분, 2회를 쓴다")
    void usesDefaults() {
        CommuteAreaSearchRequest request = new CommuteAreaSearchRequest(37.5, 127.0, null, null);

        assertThat(request.maxMinutes()).isEqualTo(60);
        assertThat(request.maxTransfers()).isEqualTo(2);
        assertThat(request.destination()).isEqualTo(new Coordinate(37.5, 127.0));
    }

    @Test
    @DisplayName("요청한 최대 통근 시간과 최대 환승 횟수를 그대로 쓴다")
    void keepsRequestedValues() {
        CommuteAreaSearchRequest request = new CommuteAreaSearchRequest(37.5, 127.0, 40, 0);

        assertThat(request.maxMinutes()).isEqualTo(40);
        assertThat(request.maxTransfers()).isZero();
    }
}
