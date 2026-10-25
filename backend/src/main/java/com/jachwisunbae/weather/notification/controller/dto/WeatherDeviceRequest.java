package com.jachwisunbae.weather.notification.controller.dto;

import com.jachwisunbae.weather.notification.domain.WeatherDevice.Permission;
import com.jachwisunbae.weather.notification.domain.WeatherDevice.Platform;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record WeatherDeviceRequest(
        @Schema(description = "앱 설치 시 생성·안전하게 보관한 32바이트 이상 난수의 base64url. 익명 회원 초기화 후에도 유지")
        @NotNull @Pattern(regexp = "[A-Za-z0-9_-]{43,128}") String installationSecret,
        @Schema(description = "FCM 등록 토큰. GRANTED이면 필수. 응답·로그에는 반환하지 않음") @Size(max = 4096) String token,
        @NotNull Platform platform, @NotNull Permission permission) {
    @Override
    public String toString() {
        return "WeatherDeviceRequest[credentials=REDACTED]";
    }
}
