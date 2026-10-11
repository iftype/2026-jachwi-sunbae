package com.jachwisunbae.map.controller.dto.response.goodprice;

import com.jachwisunbae.map.domain.goodprice.GoodPriceStore;
import com.jachwisunbae.map.service.dto.result.goodprice.GoodPriceStoreResult;
import java.math.BigDecimal;
import java.util.List;

// id는 서비스 DB의 업소 ID라 카카오 장소처럼 provider prefix를 붙이지 않는다. 다시 적재하면 바뀔 수 있다.
public record GoodPriceStoreResponse(long id, String name, String businessType, String phone, String address,
                                     BigDecimal latitude, BigDecimal longitude, int distanceMeters,
                                     List<GoodPriceMenuResponse> menus) {

    public static GoodPriceStoreResponse from(GoodPriceStoreResult result) {
        GoodPriceStore store = result.store();
        return new GoodPriceStoreResponse(store.getId(), store.getName(), store.getBusinessType(), store.getPhone(),
                store.getAddress(), store.getLatitude(), store.getLongitude(), result.distanceMeters(),
                store.getMenus().stream().map(GoodPriceMenuResponse::from).toList());
    }
}
