package com.jachwisunbae.map.controller.cctv;

import com.jachwisunbae.common.web.ApiResponse;
import com.jachwisunbae.map.controller.dto.response.cctv.CctvsResponse;
import com.jachwisunbae.map.service.cctv.CctvService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.math.BigDecimal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/maps/cctvs")
@Tag(name = "Maps", description = "주소 검색과 주변 시설 분석 API")
@SecurityRequirement(name = "bearerAuth")
public class CctvController {

    private final CctvService cctvService;

    public CctvController(CctvService cctvService) {
        this.cctvService = cctvService;
    }

    @GetMapping
    @Operation(summary = "주변 CCTV 조회", description = "반경 안의 공공 CCTV를 설치목적과 관계없이 가까운 순으로 모두 조회합니다.")
    public ApiResponse<CctvsResponse> nearby(@RequestParam BigDecimal latitude,
                                             @RequestParam BigDecimal longitude,
                                             @RequestParam int radius) {
        return ApiResponse.of(CctvsResponse.from(cctvService.nearby(latitude, longitude, radius)));
    }
}
