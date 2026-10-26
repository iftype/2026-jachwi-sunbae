package com.jachwisunbae.notification.controller;

import com.jachwisunbae.auth.web.AuthenticatedMemberId;
import com.jachwisunbae.common.web.ApiResponse;
import com.jachwisunbae.notification.service.WeatherNotificationSettingsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@Profile("!prod")
@RestController
@Tag(name = "Weather notifications")
@SecurityRequirement(name = "bearerAuth")
public class WeatherNotificationTestController {
    private final WeatherNotificationSettingsService service;

    public WeatherNotificationTestController(final WeatherNotificationSettingsService service) {
        this.service = service;
    }

    @PostMapping("/api/members/me/weather-notifications/test")
    @Operation(summary = "내 기기로 테스트 알림 즉시 발송", description = "prod 제외. 등록된 기기로 고정 문구를 바로 보내며 이력은 저장하지 않습니다. "
            + "sent=false는 기기 미등록 또는 발송 실패·비활성화입니다. 401 인증 오류, 404 MEMBER_NOT_FOUND.")
    public ApiResponse<TestPushResponse> send(@AuthenticatedMemberId final Long memberId) {
        return ApiResponse.of(new TestPushResponse(service.sendTest(memberId)));
    }

    public record TestPushResponse(boolean sent) {
    }
}
