package com.jachwisunbae.map.controller.busstop;

import com.jachwisunbae.common.web.ApiResponse;
import com.jachwisunbae.map.controller.dto.response.busstop.BusStopsResponse;
import com.jachwisunbae.map.service.busstop.BusStopService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.math.BigDecimal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/maps/bus-stops")
@Tag(name = "Maps", description = "주소 검색과 주변 시설 분석 API")
@SecurityRequirement(name = "bearerAuth")
public class BusStopController {

    private final BusStopService busStopService;

    public BusStopController(BusStopService busStopService) {
        this.busStopService = busStopService;
    }

    @GetMapping
    @Operation(summary = "주변 버스정류장 조회", description = "반경 안의 버스정류장을 가까운 순으로 모두 조회합니다. 미정차·가상 정류장은 제외합니다.")
    public ApiResponse<BusStopsResponse> nearby(@RequestParam BigDecimal latitude,
                                                @RequestParam BigDecimal longitude,
                                                @RequestParam int radius) {
        return ApiResponse.of(BusStopsResponse.from(busStopService.nearby(latitude, longitude, radius)));
    }
}
