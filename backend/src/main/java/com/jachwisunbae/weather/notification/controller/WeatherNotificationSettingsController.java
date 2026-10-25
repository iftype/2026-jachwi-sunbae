package com.jachwisunbae.weather.notification.controller;

import com.jachwisunbae.auth.web.AuthenticatedMemberId;
import com.jachwisunbae.common.web.ApiResponse;
import com.jachwisunbae.weather.notification.controller.dto.WeatherDeviceRequest;
import com.jachwisunbae.weather.notification.controller.dto.WeatherDeviceResponse;
import com.jachwisunbae.weather.notification.controller.dto.WeatherNotificationSettingsRequest;
import com.jachwisunbae.weather.notification.controller.dto.WeatherNotificationSettingsResponse;
import com.jachwisunbae.weather.notification.service.WeatherNotificationSettingsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/members/me")
@Tag(name = "Weather notifications", description = "익명 회원 자신의 정기 생활 날씨 알림")
@SecurityRequirement(name = "bearerAuth")
public class WeatherNotificationSettingsController {
    private final WeatherNotificationSettingsService service;

    public WeatherNotificationSettingsController(final WeatherNotificationSettingsService service) {
        this.service = service;
    }

    @GetMapping("/weather-notification-settings")
    @Operation(summary = "날씨 알림 수신 설정 조회", description = "200: 기본 OFF. 401 인증 오류, 404 MEMBER_NOT_FOUND.")
    public ApiResponse<WeatherNotificationSettingsResponse> settings(@AuthenticatedMemberId final Long memberId) {
        return ApiResponse.of(new WeatherNotificationSettingsResponse(service.enabled(memberId)));
    }

    @PutMapping("/weather-notification-settings")
    @Operation(summary = "날씨 알림 수신 동의·해제", description = "200: 설정 반영. 해제 시 미전송·재시도 대기를 취소합니다. "
            + "이미 FCM에 요청한 알림은 회수할 수 없습니다. 400 INVALID_REQUEST, 401 인증 오류, 404 MEMBER_NOT_FOUND.")
    public ApiResponse<WeatherNotificationSettingsResponse> settings(@AuthenticatedMemberId final Long memberId,
            @Valid @RequestBody final WeatherNotificationSettingsRequest request) {
        service.setEnabled(memberId, request.enabled());
        return ApiResponse.of(new WeatherNotificationSettingsResponse(request.enabled()));
    }

    @GetMapping("/weather-devices")
    @Operation(summary = "내 날씨 알림 기기 목록", description = "200: 기기 ID·플랫폼·권한·활성 상태. 토큰·비밀키 제외. 401 인증 오류, 404 MEMBER_NOT_FOUND.")
    public ApiResponse<List<WeatherDeviceResponse>> devices(@AuthenticatedMemberId final Long memberId) {
        return ApiResponse.of(service.devices(memberId).stream().map(WeatherDeviceResponse::from).toList());
    }

    @PutMapping("/weather-devices/{installationId}")
    @Operation(summary = "FCM 기기 등록·갱신", description = "앱 설치 UUID와 별도 비밀키를 익명 회원 초기화와 독립적으로 보관합니다. "
            + "설치 비밀키가 일치해야 다른 익명 회원으로 이전할 수 있으며 이전 회원의 수신 동의는 이전되지 않습니다. "
            + "DENIED이면 토큰을 지웁니다. 200 성공, 400 WEATHER_DEVICE_INVALID/WEATHER_DEVICE_CONFLICT/WEATHER_DEVICE_LIMIT_EXCEEDED, "
            + "401 인증 오류, 404 MEMBER_NOT_FOUND. 회원별 활성 기기 최대 10개.")
    public ApiResponse<WeatherDeviceResponse> register(@AuthenticatedMemberId final Long memberId,
            @PathVariable final UUID installationId, @Valid @RequestBody final WeatherDeviceRequest request) {
        return ApiResponse.of(WeatherDeviceResponse.from(service.register(memberId, installationId, request.installationSecret(),
                request.token(), request.platform(), request.permission())));
    }

    @DeleteMapping("/weather-devices/{installationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "내 알림 기기 해지", description = "204: 토큰 삭제·비활성화. 설치 비밀키 해시는 재등록 소유 검증을 위해 유지. "
            + "401 인증 오류, 404 WEATHER_DEVICE_NOT_FOUND/MEMBER_NOT_FOUND.")
    public void revoke(@AuthenticatedMemberId final Long memberId, @PathVariable final UUID installationId) {
        service.revoke(memberId, installationId);
    }
}
