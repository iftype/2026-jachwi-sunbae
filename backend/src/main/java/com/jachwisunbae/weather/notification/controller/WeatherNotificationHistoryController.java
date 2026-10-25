package com.jachwisunbae.weather.notification.controller;

import com.jachwisunbae.auth.web.AuthenticatedMemberId;
import com.jachwisunbae.common.web.ApiResponse;
import com.jachwisunbae.weather.notification.controller.dto.WeatherNotificationReceiptRequest;
import com.jachwisunbae.weather.notification.controller.dto.WeatherNotificationReceiptRequest.Receipt;
import com.jachwisunbae.weather.notification.controller.dto.WeatherNotificationResponse;
import com.jachwisunbae.weather.notification.controller.dto.WeatherNotificationSummaryResponse;
import com.jachwisunbae.weather.notification.service.WeatherNotificationHistoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/members/me/weather-notifications")
@Tag(name = "Weather notifications")
@SecurityRequirement(name = "bearerAuth")
public class WeatherNotificationHistoryController {
    private final WeatherNotificationHistoryService service;

    public WeatherNotificationHistoryController(final WeatherNotificationHistoryService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "최근 날씨 알림 목록", description = "200: 준비된 최근 알림, 최신순. limit 1~100, 기본 20. "
            + "FCM 실패·미발송 상태는 상세에서 확인. 400 INVALID_REQUEST, 401 인증 오류, 404 MEMBER_NOT_FOUND.")
    public ApiResponse<List<WeatherNotificationSummaryResponse>> recent(@AuthenticatedMemberId final Long memberId,
            @RequestParam(defaultValue = "20") final int limit) {
        return ApiResponse.of(service.recent(memberId, limit).stream().map(WeatherNotificationSummaryResponse::from).toList());
    }

    @GetMapping("/{notificationId}")
    @Operation(summary = "알림 당시의 7가지 생활 날씨 상세", description = "200: 당시 격자·위치 확인시각·예보·7가지 판정·기기별 전송 상태. "
            + "FCM data.notificationId로 접근합니다. 현재 위치와 구분하세요. 401 인증 오류, 404 WEATHER_NOTIFICATION_NOT_FOUND/MEMBER_NOT_FOUND.")
    public ApiResponse<WeatherNotificationResponse> find(@AuthenticatedMemberId final Long memberId, @PathVariable final UUID notificationId) {
        return ApiResponse.of(WeatherNotificationResponse.from(service.find(memberId, notificationId)));
    }

    @PutMapping("/{notificationId}/receipts/{installationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "앱의 알림 수신·열람 보고", description = "204: 서버 수신시각으로 최초 보고를 보존. OPENED는 RECEIVED도 포함. "
            + "보고는 기기 주장으로 FCM 수락과 별개입니다. 400 WEATHER_NOTIFICATION_RECEIPT_INVALID/INVALID_REQUEST, "
            + "401 인증 오류, 404 WEATHER_NOTIFICATION_NOT_FOUND/MEMBER_NOT_FOUND.")
    public void receipt(@AuthenticatedMemberId final Long memberId, @PathVariable final UUID notificationId,
            @PathVariable final UUID installationId, @Valid @RequestBody final WeatherNotificationReceiptRequest request) {
        service.receipt(memberId, notificationId, installationId, request.status() == Receipt.OPENED);
    }
}
