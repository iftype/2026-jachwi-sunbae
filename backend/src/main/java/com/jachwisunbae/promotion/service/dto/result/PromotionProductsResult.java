package com.jachwisunbae.promotion.service.dto.result;

import com.jachwisunbae.promotion.domain.ConvenienceBrand;
import com.jachwisunbae.promotion.domain.PromotionProduct;
import java.time.LocalDateTime;
import java.util.List;

// 브랜드의 저장된 행사상품 목록과 마지막 정상 수집 시각(KST)을 함께 전달한다.
public record PromotionProductsResult(ConvenienceBrand brand, LocalDateTime collectedAt,
                                      List<PromotionProduct> products) {

    public PromotionProductsResult {
        products = List.copyOf(products);
    }
}
