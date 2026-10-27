package com.jachwisunbae.notification.controller.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record WeatherDeviceRequest(
        @NotNull UUID installationId,
        @Schema(description = "설치별 32바이트 이상 난수의 base64url. 회원 변경 시 소유 증명에 사용")
        @NotNull @Pattern(regexp = "[A-Za-z0-9_-]{43,128}") String installationSecret,
        @Schema(description = "FCM 토큰. 실제 유효성은 FCM에서 확인하며 응답·로그에 노출하지 않습니다.")
        @NotBlank @Size(max = 4096) String token) {
    @Override
    public String toString() {
        return "WeatherDeviceRequest[credentials=REDACTED]";
    }
}
