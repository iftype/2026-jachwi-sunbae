package com.jachwisunbae.notification.controller;

import com.jachwisunbae.auth.web.AuthenticatedMemberId;
import com.jachwisunbae.common.web.ApiResponse;
import com.jachwisunbae.notification.controller.dto.WeatherDeviceRequest;
import com.jachwisunbae.notification.controller.dto.WeatherDeviceResponse;
import com.jachwisunbae.notification.controller.dto.WeatherNotificationSettingsRequest;
import com.jachwisunbae.notification.controller.dto.WeatherNotificationSettingsResponse;
import com.jachwisunbae.notification.service.WeatherNotificationSettingsService;
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
    @Operation(summary = "날씨 알림 수신 동의·해제", description = "동의를 끄면 이후 발송 대상에서 제외합니다. "
            + "이미 FCM에 요청한 알림은 회수할 수 없습니다. 400 INVALID_REQUEST, 401 인증 오류, 404 MEMBER_NOT_FOUND.")
    public ApiResponse<WeatherNotificationSettingsResponse> settings(@AuthenticatedMemberId final Long memberId,
            @Valid @RequestBody final WeatherNotificationSettingsRequest request) {
        service.setEnabled(memberId, request.enabled());
        return ApiResponse.of(new WeatherNotificationSettingsResponse(request.enabled()));
    }

    @GetMapping("/weather-devices/current")
    @Operation(summary = "내 날씨 알림 기기 조회", description = "200: 회원당 한 기기, 없으면 data=null. 토큰·비밀키 제외. 401 인증 오류, 404 MEMBER_NOT_FOUND.")
    public ApiResponse<WeatherDeviceResponse> device(@AuthenticatedMemberId final Long memberId) {
        return ApiResponse.of(service.device(memberId).map(WeatherDeviceResponse::from).orElse(null));
    }

    @PutMapping("/weather-devices/current")
    @Operation(summary = "내 FCM 기기 등록·갱신", description = "회원당 한 설치만 유지합니다. 익명 회원 변경 시 같은 설치의 비밀키를 검증합니다. "
            + "수신 동의는 이전되지 않습니다. OS 권한 해제 시 DELETE를 호출합니다. 200 성공, 400 INVALID_REQUEST/WEATHER_DEVICE_CONFLICT, "
            + "401 인증 오류, 404 MEMBER_NOT_FOUND.")
    public ApiResponse<WeatherDeviceResponse> register(@AuthenticatedMemberId final Long memberId,
            @Valid @RequestBody final WeatherDeviceRequest request) {
        return ApiResponse.of(WeatherDeviceResponse.from(service.register(memberId, request.installationId(), request.installationSecret(),
                request.token())));
    }

    @DeleteMapping("/weather-devices/current")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "내 알림 기기 해지", description = "204: 토큰 삭제. 설치 비밀키 해시는 소유 검증을 위해 유지. 401 인증 오류, 404 MEMBER_NOT_FOUND.")
    public void revoke(@AuthenticatedMemberId final Long memberId) {
        service.revoke(memberId);
    }
}
