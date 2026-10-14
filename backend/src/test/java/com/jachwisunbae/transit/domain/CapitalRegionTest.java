package com.jachwisunbae.transit.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class CapitalRegionTest {

    @ParameterizedTest(name = "{0}: 노선망 {1}, 결과 {2}")
    @DisplayName("통계청 행정동 코드의 시도로 노선망과 결과에 들어가는지 정한다")
    @CsvSource(nullValues = "NULL", value = {
            "11010530, true, true",
            "31011510, true, true",
            "23010520, true, false",
            "21010510, false, false",
            "NULL, false, false"
    })
    void decidesBySido(final String adminDongCode, final boolean inNetwork, final boolean inResult) {
        assertThat(CapitalRegion.includesInNetwork(adminDongCode)).isEqualTo(inNetwork);
        assertThat(CapitalRegion.includesInResult(adminDongCode)).isEqualTo(inResult);
    }
}
