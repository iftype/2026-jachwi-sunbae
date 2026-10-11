package com.jachwisunbae.map.service.dto.result.goodprice;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

// dataAsOf는 조회한 업소의 공공데이터 기준일.
public record GoodPriceStoresResult(BigDecimal latitude, BigDecimal longitude, int radius, LocalDate dataAsOf,
                                    List<GoodPriceStoreResult> stores) {
}
