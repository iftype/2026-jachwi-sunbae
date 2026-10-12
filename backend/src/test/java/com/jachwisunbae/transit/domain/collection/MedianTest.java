package com.jachwisunbae.transit.domain.collection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class MedianTest {

    @Test
    @DisplayName("홀수 개면 가운데 값을 쓴다")
    void usesMiddleValueForOddCount() {
        assertThat(Median.of(new int[]{300, 60, 120})).isEqualTo(120);
    }

    @Test
    @DisplayName("짝수 개면 가운데 두 값의 평균을 반올림한다")
    void roundsAverageOfMiddleValuesForEvenCount() {
        assertThat(Median.of(new int[]{10, 30, 61, 70, 90, 200})).isEqualTo(66);
    }

    @Test
    @DisplayName("입력 배열의 순서를 바꾸지 않는다")
    void keepsInputOrder() {
        int[] values = {3, 1, 2};

        Median.of(values);

        assertThat(values).containsExactly(3, 1, 2);
    }

    @Test
    @DisplayName("값이 없으면 중앙값을 구하지 않는다")
    void rejectsEmptyValues() {
        assertThatThrownBy(() -> Median.of(new int[0])).isInstanceOf(IllegalArgumentException.class);
    }
}
