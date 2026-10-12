package com.jachwisunbae.map.controller.dto.response.goodprice;

import com.jachwisunbae.map.service.dto.result.goodprice.GoodPriceStoresResult;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

// dataAsOf는 공공데이터 기준일이다. 가격이 실시간 정보가 아니라는 것을 표시할 때 쓴다.
// 반경 안에 업소가 없어도 내려주며, 데이터가 적재되기 전에만 null이다.
public record GoodPriceStoresResponse(Center center, int radius, int count, LocalDate dataAsOf,
                                      List<GoodPriceStoreResponse> stores) {

    public static GoodPriceStoresResponse from(GoodPriceStoresResult result) {
        List<GoodPriceStoreResponse> stores = result.stores().stream().map(GoodPriceStoreResponse::from).toList();
        return new GoodPriceStoresResponse(new Center(result.latitude(), result.longitude()), result.radius(),
                stores.size(), result.dataAsOf(), stores);
    }

    public record Center(BigDecimal latitude, BigDecimal longitude) {
    }
}
