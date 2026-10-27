package com.jachwisunbae.promotion.controller;

import com.jachwisunbae.common.web.ApiResponse;
import com.jachwisunbae.promotion.controller.dto.response.PromotionProductsResponse;
import com.jachwisunbae.promotion.domain.ConvenienceBrand;
import com.jachwisunbae.promotion.service.PromotionQueryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/promotions")
@Tag(name = "Promotions", description = "편의점 행사상품")
@SecurityRequirement(name = "bearerAuth")
public class PromotionController {

    private final PromotionQueryService service;

    public PromotionController(final PromotionQueryService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "브랜드별 행사상품 전체 조회", description = "DB에 저장된 브랜드 공통 행사상품 전체를 저장 순서로 반환합니다. "
            + "외부 수집을 실행하지 않으며 특정 매장의 재고·행사 적용을 보장하지 않습니다. "
            + "미수집 시 빈 목록과 collectedAt=null. 400 brand 누락·잘못된 값, 401 인증 오류.")
    public ApiResponse<PromotionProductsResponse> findByBrand(
            @Parameter(description = "조회할 편의점 브랜드", example = "EMART24")
            @RequestParam final ConvenienceBrand brand) {
        return ApiResponse.of(PromotionProductsResponse.from(service.findByBrand(brand)));
    }
}
