package com.jachwisunbae.map.controller.goodprice;

import com.jachwisunbae.common.web.ApiResponse;
import com.jachwisunbae.map.controller.dto.response.goodprice.GoodPriceStoresResponse;
import com.jachwisunbae.map.service.goodprice.GoodPriceStoreService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.math.BigDecimal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/maps/good-price-stores")
@Tag(name = "Maps", description = "주소 검색과 주변 시설 분석 API")
@SecurityRequirement(name = "bearerAuth")
public class GoodPriceStoreController {

    private final GoodPriceStoreService goodPriceStoreService;

    public GoodPriceStoreController(GoodPriceStoreService goodPriceStoreService) {
        this.goodPriceStoreService = goodPriceStoreService;
    }

    @GetMapping
    @Operation(summary = "주변 착한가격업소 조회")
    public ApiResponse<GoodPriceStoresResponse> nearby(@RequestParam BigDecimal latitude,
                                                       @RequestParam BigDecimal longitude,
                                                       @RequestParam int radius) {
        return ApiResponse.of(GoodPriceStoresResponse.from(goodPriceStoreService.nearby(latitude, longitude, radius)));
    }
}
