package com.jachwisunbae.map.service.dto.result.goodprice;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

// dataAsOf는 적재된 공공데이터의 기준일. 조회 결과가 없어도 같은 값이고, 적재 전이면 null이다.
public record GoodPriceStoresResult(BigDecimal latitude, BigDecimal longitude, int radius, LocalDate dataAsOf,
                                    List<GoodPriceStoreResult> stores) {
}
