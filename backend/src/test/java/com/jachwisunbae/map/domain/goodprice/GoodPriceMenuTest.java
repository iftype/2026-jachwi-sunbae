package com.jachwisunbae.map.domain.goodprice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class GoodPriceMenuTest {

    @Test
    @DisplayName("메뉴명과 가격으로 메뉴를 만든다")
    void createsMenu() {
        assertThat(GoodPriceMenu.of("김치찌개", "7000")).contains(new GoodPriceMenu("김치찌개", "7000"));
    }

    @Test
    @DisplayName("메뉴명은 있지만 가격이 없으면 가격 없이 만든다")
    void allowsMissingPrice() {
        assertThat(GoodPriceMenu.of("된장찌개", null)).contains(new GoodPriceMenu("된장찌개", null));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = " ")
    @DisplayName("메뉴명이 없으면 가격이 있어도 메뉴로 보지 않는다")
    void skipsMenuWithoutName(String name) {
        assertThat(GoodPriceMenu.of(name, "7000")).isEmpty();
    }

    @Test
    @DisplayName("메뉴명 없이 직접 만들 수 없다")
    void requiresName() {
        assertThatThrownBy(() -> new GoodPriceMenu(" ", "7000")).isInstanceOf(IllegalArgumentException.class);
    }
}
