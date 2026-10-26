package com.jachwisunbae.notification.controller;

import com.jachwisunbae.auth.web.AuthenticatedMemberId;
import com.jachwisunbae.common.web.ApiResponse;
import com.jachwisunbae.notification.controller.dto.WeatherNotificationResponse;
import com.jachwisunbae.notification.service.WeatherNotificationHistoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
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

    @GetMapping("/{notificationId}")
    @Operation(summary = "알림 당시의 생활 날씨 안내", description = "FCM data.notificationId로 본인의 당시 격자·문구·notices를 조회합니다. "
            + "401 인증 오류, 404 WEATHER_NOTIFICATION_NOT_FOUND/MEMBER_NOT_FOUND.")
    public ApiResponse<WeatherNotificationResponse> find(@AuthenticatedMemberId final Long memberId, @PathVariable final UUID notificationId) {
        return ApiResponse.of(WeatherNotificationResponse.from(service.find(memberId, notificationId)));
    }

}
