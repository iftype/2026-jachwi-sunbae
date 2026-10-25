package com.jachwisunbae.weather.controller.dto;

import com.jachwisunbae.weather.domain.MemberWeatherLocation;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(description = "마지막 동기화 위치. available은 등록 여부이며 알림용 위치 유효기간을 뜻하지 않습니다.")
public record WeatherLocationResponse(boolean available, Integer gridX, Integer gridY,
                                      Instant observedAt, Instant syncedAt) {
    public static WeatherLocationResponse from(final MemberWeatherLocation location) {
        return new WeatherLocationResponse(location.isAvailable(), location.grid() == null ? null : location.grid().nx(),
                location.grid() == null ? null : location.grid().ny(), location.observedAt(), location.syncedAt());
    }
}
