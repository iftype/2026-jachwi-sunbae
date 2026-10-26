package com.jachwisunbae.notification.controller;

import com.jachwisunbae.auth.web.AuthenticatedMemberId;
import com.jachwisunbae.common.web.ApiResponse;
import com.jachwisunbae.notification.controller.dto.WeatherNotificationResponse;
import com.jachwisunbae.notification.controller.dto.WeatherNotificationSummaryResponse;
import com.jachwisunbae.notification.service.WeatherNotificationHistoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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
    @Operation(summary = "알림 당시의 생활 날씨 안내", description = "200: 당시 격자·문구·조건을 충족한 notices·FCM 요청 결과. notices에는 최대 5개 안내만 포함하며 빈 목록도 가능합니다. "
            + "FCM data.notificationId로 접근합니다. 현재 위치와 구분하세요. 401 인증 오류, 404 WEATHER_NOTIFICATION_NOT_FOUND/MEMBER_NOT_FOUND.")
    public ApiResponse<WeatherNotificationResponse> find(@AuthenticatedMemberId final Long memberId, @PathVariable final UUID notificationId) {
        return ApiResponse.of(WeatherNotificationResponse.from(service.find(memberId, notificationId)));
    }

}
