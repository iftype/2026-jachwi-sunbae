package com.jachwisunbae.promotion.controller.dto.response;

import com.jachwisunbae.promotion.domain.ConvenienceBrand;
import com.jachwisunbae.promotion.service.dto.result.PromotionProductsResult;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

public record PromotionProductsResponse(
        ConvenienceBrand brand,
        int count,
        @Schema(description = "마지막 정상 수집 시각(KST, +09:00), 미수집 시 null", nullable = true,
                example = "2026-10-27T04:02:13+09:00")
        OffsetDateTime collectedAt,
        @Schema(description = "저장 순서의 전체 행사상품 목록")
        List<PromotionProductResponse> products
) {

    public static PromotionProductsResponse from(final PromotionProductsResult result) {
        List<PromotionProductResponse> products = result.products().stream().map(PromotionProductResponse::from).toList();
        // DB의 수집 시각은 이미 KST이므로 시간을 옮기지 않고 오프셋만 붙인다.
        OffsetDateTime collectedAt = result.collectedAt() == null ? null
                : result.collectedAt().atOffset(ZoneOffset.ofHours(9));
        return new PromotionProductsResponse(result.brand(), products.size(), collectedAt, products);
    }
}
