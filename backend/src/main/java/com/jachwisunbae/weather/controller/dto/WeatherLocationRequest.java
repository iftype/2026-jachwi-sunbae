package com.jachwisunbae.weather.controller.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

public record WeatherLocationRequest(@NotNull Double latitude, @NotNull Double longitude,
                                     @Schema(description = "기기가 실제 위치를 확인한 시각. ISO 8601 오프셋 필수. 재전송 시 바꾸지 않습니다.")
                                     @NotNull Instant observedAt) {
}
