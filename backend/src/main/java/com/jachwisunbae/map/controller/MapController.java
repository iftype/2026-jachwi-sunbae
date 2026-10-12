package com.jachwisunbae.map.controller;

import com.jachwisunbae.common.web.ApiResponse;
import com.jachwisunbae.map.controller.dto.response.MapAddressResponse;
import com.jachwisunbae.map.controller.dto.response.NearbyResponse;
import com.jachwisunbae.map.service.MapService;
import com.jachwisunbae.map.type.MapCategory;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/maps")
@Tag(name = "Maps", description = "주소 검색과 주변 시설 분석 API")
public class MapController {

    private final MapService mapService;

    public MapController(MapService mapService) {
        this.mapService = mapService;
    }

    @GetMapping("/geocode")
    @Operation(summary = "주소 검색", description = "주소 검색어를 WGS84 위도 경도 좌표 후보로 변환합니다.")
    public ApiResponse<List<MapAddressResponse>> geocode(@RequestParam String query) {
        return ApiResponse.of(mapService.geocode(query).stream().map(MapAddressResponse::from).toList());
    }

    @GetMapping("/reverse-geocode")
    @Operation(summary = "역지오코딩", description = "WGS84 좌표의 도로명주소를 조회합니다. 도로명주소가 없는 좌표는 404 MAP_ADDRESS_NOT_FOUND로 응답합니다."
    )
    public ApiResponse<MapAddressResponse> reverseGeocode(@RequestParam BigDecimal latitude, @RequestParam BigDecimal longitude) {
        return ApiResponse.of(MapAddressResponse.from(mapService.reverseGeocode(latitude, longitude)));
    }

    @GetMapping("/nearby")
    @Operation(summary = "주변 시설 조회", description = "반경과 카테고리에 맞는 실제 장소 좌표와 반환 장소 기준 집계를 조회합니다."
    )
    public ApiResponse<NearbyResponse> nearby(@RequestParam BigDecimal latitude, @RequestParam BigDecimal longitude,
                                              @RequestParam int radius, @RequestParam(required = false) Set<MapCategory> categories) {
        return ApiResponse.of(NearbyResponse.from(mapService.nearby(latitude, longitude, radius, categories)));
    }
}
