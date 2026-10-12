package com.jachwisunbae.transit.domain.vo;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class SecondsTest {

    @Test
    @DisplayName("0초 이상이면 만들 수 있다")
    void acceptsZeroOrMore() {
        assertThatCode(() -> new Seconds(0)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("음수 시간은 만들 수 없다")
    void rejectsNegative() {
        assertThatThrownBy(() -> new Seconds(-1))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
