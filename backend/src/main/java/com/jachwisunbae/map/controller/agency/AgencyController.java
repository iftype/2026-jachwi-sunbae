package com.jachwisunbae.map.controller.agency;

import com.jachwisunbae.common.web.ApiResponse;
import com.jachwisunbae.map.controller.dto.response.agency.AgenciesResponse;
import com.jachwisunbae.map.service.agency.AgencyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.math.BigDecimal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/maps/agencies")
@Tag(name = "Maps", description = "주소 검색과 주변 시설 분석 API")
public class AgencyController {

    private final AgencyService agencyService;

    public AgencyController(AgencyService agencyService) {
        this.agencyService = agencyService;
    }

    @GetMapping
    @Operation(summary = "주변 중개업소 조회", description = "반경 안의 중개업소를 가까운 순으로 전화번호, 카카오맵 상세 페이지 URL과 함께 조회합니다. "
    )
    public ApiResponse<AgenciesResponse> nearby(@RequestParam BigDecimal latitude,
                                                @RequestParam BigDecimal longitude,
                                                @RequestParam int radius) {
        return ApiResponse.of(AgenciesResponse.from(agencyService.nearby(latitude, longitude, radius)));
    }
}
