package com.jachwisunbae.map.service.dto.result.goodprice;

import com.jachwisunbae.map.domain.goodprice.GoodPriceStore;

// 기준 좌표에서 업소까지의 거리(m)를 함께 담는다.
public record GoodPriceStoreResult(GoodPriceStore store, int distanceMeters) {
}
