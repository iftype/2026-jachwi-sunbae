package com.jachwisunbae.notification.controller.dto;

import io.swagger.v3.oas.annotations.media.Schema;

public record WeatherNotificationSettingsResponse(
        @Schema(description = "회원 수신 동의. 서버 스케줄러 활성화와는 별개이며 기본 false") boolean enabled) { }
