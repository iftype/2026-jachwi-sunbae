package com.jachwisunbae.transit.controller;

import com.jachwisunbae.common.web.ApiResponse;
import com.jachwisunbae.transit.controller.dto.request.CommuteAreaSearchRequest;
import com.jachwisunbae.transit.controller.dto.response.CommuteAreaSearchResponse;
import com.jachwisunbae.transit.service.CommuteAreaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/commute-areas")
@Tag(name = "Commute Areas", description = "목적지 기반 생활권 탐색 API")
public class CommuteAreaController {

    private final CommuteAreaService commuteAreaService;

    public CommuteAreaController(final CommuteAreaService commuteAreaService) {
        this.commuteAreaService = commuteAreaService;
    }

    @GetMapping
    @Operation(summary = "생활권 탐색", description = "목적지까지 대중교통으로 최대 통근 시간 안에 갈 수 있는 동네를 "
            + "행정동 단위로 경계, 정류장과 함께 조회합니다.")
    public ApiResponse<CommuteAreaSearchResponse> search(
            @Valid @ModelAttribute final CommuteAreaSearchRequest request) {
        return ApiResponse.of(CommuteAreaSearchResponse.from(commuteAreaService.search(request.destination(),
                request.maxMinutes(), request.maxTransfers())));
    }
}
