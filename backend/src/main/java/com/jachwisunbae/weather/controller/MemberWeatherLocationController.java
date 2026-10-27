package com.jachwisunbae.weather.controller;

import com.jachwisunbae.auth.web.AuthenticatedMemberId;
import com.jachwisunbae.common.web.ApiResponse;
import com.jachwisunbae.weather.controller.dto.WeatherLocationRequest;
import com.jachwisunbae.weather.controller.dto.WeatherLocationResponse;
import com.jachwisunbae.weather.service.MemberWeatherLocationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/members/me/weather-location")
@Tag(name = "Weather locations", description = "익명 인증 회원 자신의 마지막 저장 위치")
@SecurityRequirement(name = "bearerAuth")
public class MemberWeatherLocationController {
    private final MemberWeatherLocationService service;

    public MemberWeatherLocationController(final MemberWeatherLocationService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "마지막 저장 위치 조회", description = "200: 저장된 격자와 서버 저장시각. "
            + "미등록·삭제 후에는 available=false이며 격자와 updatedAt은 null입니다. 401 ACCESS_TOKEN_INVALID, 404 MEMBER_NOT_FOUND.")
    public ApiResponse<WeatherLocationResponse> find(@AuthenticatedMemberId final Long memberId) {
        return ApiResponse.of(WeatherLocationResponse.from(service.find(memberId)));
    }

    @PutMapping
    @Operation(summary = "현재 위치 동기화", description = "위경도를 격자로 변환하고 정확한 좌표는 보관하지 않습니다. "
            + "회원의 기존 격자를 요청한 격자로 갱신합니다. 정기 알림은 저장시각과 관계없이 마지막 저장 위치를 사용합니다. "
            + "200 성공, 400 INVALID_REQUEST/WEATHER_COORDINATE_INVALID/WEATHER_LOCATION_UNSUPPORTED, "
            + "401 ACCESS_TOKEN_INVALID, 404 MEMBER_NOT_FOUND.")
    public ApiResponse<WeatherLocationResponse> sync(@AuthenticatedMemberId final Long memberId,
                                                    @Valid @RequestBody final WeatherLocationRequest request) {
        return ApiResponse.of(WeatherLocationResponse.from(service.sync(memberId, request.latitude(), request.longitude())));
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "날씨 위치 사용 해제", description = "위치 권한 철회·위치 사용 중단 시 호출합니다. "
            + "204: 본인의 위치 행을 삭제합니다. 이후 PUT 요청이 오면 다시 등록됩니다. "
            + "401 ACCESS_TOKEN_INVALID, 404 MEMBER_NOT_FOUND.")
    public void delete(@AuthenticatedMemberId final Long memberId) {
        service.delete(memberId);
    }
}
