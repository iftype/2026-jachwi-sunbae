package com.jachwisunbae.guest.controller;

import com.jachwisunbae.common.web.ApiResponse;
import com.jachwisunbae.guest.controller.dto.response.GuestSampleResponses;
import com.jachwisunbae.checklist.controller.dto.response.UserChecklistListResponse;
import com.jachwisunbae.property.controller.dto.response.PropertyListResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/guest")
@Tag(name = "Guest", description = "비회원 체험 API")
public class GuestController {

    @GetMapping("/properties")
    @Operation(summary = "게스트 매물 목록 조회",
            description = "인증 없이 체험할 수 있는 매물 목록 샘플을 조회합니다.")
    public ApiResponse<PropertyListResponse> findProperties() {
        return ApiResponse.of("게스트 매물 목록을 조회했습니다.", GuestSampleResponses.properties());
    }

    @GetMapping("/checklists")
    @Operation(summary = "게스트 사용자 체크리스트 목록 조회",
            description = "인증 없이 체험할 수 있는 사용자 체크리스트 목록 샘플을 조회합니다.")
    public ApiResponse<UserChecklistListResponse> findChecklists() {
        return ApiResponse.of("게스트 체크리스트 목록을 조회했습니다.", GuestSampleResponses.checklists());
    }
}
