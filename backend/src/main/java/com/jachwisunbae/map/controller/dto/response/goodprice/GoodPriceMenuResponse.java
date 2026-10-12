package com.jachwisunbae.map.controller.dto.response.goodprice;

import com.jachwisunbae.map.domain.goodprice.GoodPriceMenu;

// price는 공공데이터 원본 문자열이다. "무료", "25000~45000"처럼 숫자가 아닐 수 있고 없으면 null이다.
public record GoodPriceMenuResponse(String name, String price) {

    public static GoodPriceMenuResponse from(GoodPriceMenu menu) {
        return new GoodPriceMenuResponse(menu.name(), menu.price());
    }
}
