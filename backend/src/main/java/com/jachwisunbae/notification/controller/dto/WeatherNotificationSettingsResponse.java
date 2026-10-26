package com.jachwisunbae.notification.controller.dto;

import io.swagger.v3.oas.annotations.media.Schema;

public record WeatherNotificationSettingsResponse(
        @Schema(description = "회원 수신 동의. 서버 전역 발송 플래그·기기 OS 권한과는 별개이며 기본 false") boolean enabled) { }
