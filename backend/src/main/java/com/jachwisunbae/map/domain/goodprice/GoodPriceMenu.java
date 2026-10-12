package com.jachwisunbae.map.domain.goodprice;

import java.util.Optional;

// 착한가격업소의 메뉴와 가격. 가격은 "7000", "무료", "25000~45000"처럼 숫자가 아닐 수 있어 원본 문자열 그대로 둔다.
public record GoodPriceMenu(String name, String price) {

    public GoodPriceMenu {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("메뉴명은 필수입니다.");
        }
    }

    // 원본의 메뉴N/가격N 한 쌍을 메뉴로 만든다. 메뉴명이 없으면 가격이 있어도 메뉴로 보지 않는다.
    public static Optional<GoodPriceMenu> of(String name, String price) {
        if (name == null || name.isBlank()) {
            return Optional.empty();
        }
        return Optional.of(new GoodPriceMenu(name, price));
    }
}
