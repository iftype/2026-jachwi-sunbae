package com.jachwisunbae.promotion.controller.dto.response;

import com.jachwisunbae.promotion.domain.ProductCategory;
import com.jachwisunbae.promotion.domain.PromotionProduct;
import com.jachwisunbae.promotion.domain.PromotionType;
import io.swagger.v3.oas.annotations.media.Schema;

// 목록 교체 때마다 바뀌는 DB 내부 ID는 노출하지 않는다.
public record PromotionProductResponse(
        String name,
        @Schema(description = "원 단위 판매가격", example = "2500")
        int price,
        String imageUrl,
        ProductCategory category,
        PromotionType promotionType
) {

    public static PromotionProductResponse from(final PromotionProduct product) {
        return new PromotionProductResponse(product.name(), product.price(), product.imageUrl(), product.category(),
                product.promotionType());
    }
}
