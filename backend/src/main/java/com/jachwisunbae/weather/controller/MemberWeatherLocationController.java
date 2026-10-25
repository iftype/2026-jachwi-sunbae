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
@Tag(name = "Weather locations", description = "익명 인증 회원 자신의 마지막 위치 동기화")
@SecurityRequirement(name = "bearerAuth")
public class MemberWeatherLocationController {
    private final MemberWeatherLocationService service;

    public MemberWeatherLocationController(final MemberWeatherLocationService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "마지막 동기화 위치 조회", description = "200: 등록된 격자·실제 확인시각·서버 동기화시각. "
            + "미등록·해제는 available=false. 401 ACCESS_TOKEN_INVALID, 404 MEMBER_NOT_FOUND.")
    public ApiResponse<WeatherLocationResponse> find(@AuthenticatedMemberId final Long memberId) {
        return ApiResponse.of(WeatherLocationResponse.from(service.find(memberId)));
    }

    @PutMapping
    @Operation(summary = "현재 위치 동기화", description = "위경도를 격자로 변환하고 정확한 좌표는 보관하지 않습니다. "
            + "최근 5분 내 위치와 최대 1분 미래의 기기 시각 오차를 허용합니다. "
            + "동일·이전 확인시각의 재전송은 갱신하지 않고 최종 저장 상태를 반환합니다. "
            + "200 성공, 400 INVALID_REQUEST/WEATHER_COORDINATE_INVALID/WEATHER_LOCATION_UNSUPPORTED/WEATHER_LOCATION_TIME_INVALID, "
            + "401 ACCESS_TOKEN_INVALID, 404 MEMBER_NOT_FOUND.")
    public ApiResponse<WeatherLocationResponse> sync(@AuthenticatedMemberId final Long memberId,
                                                    @Valid @RequestBody final WeatherLocationRequest request) {
        return ApiResponse.of(WeatherLocationResponse.from(service.sync(memberId, request.latitude(), request.longitude(), request.observedAt())));
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "날씨 위치 사용 해제", description = "위치 권한 철회·위치 사용 중단 시 호출합니다. "
            + "204: 격자 제거 및 해제 시각 보존. 이전에 획득한 지연 요청은 위치를 복원하지 않습니다. "
            + "401 ACCESS_TOKEN_INVALID, 404 MEMBER_NOT_FOUND.")
    public void invalidate(@AuthenticatedMemberId final Long memberId) {
        service.invalidate(memberId);
    }
}
