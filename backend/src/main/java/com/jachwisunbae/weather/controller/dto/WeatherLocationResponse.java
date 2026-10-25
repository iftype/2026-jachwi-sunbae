package com.jachwisunbae.weather.controller.dto;

import com.jachwisunbae.weather.domain.MemberWeatherLocation;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(description = "마지막 저장 위치. available은 격자 존재 여부이며 updatedAt은 기록용 서버 저장시각입니다. 위치 유효기간은 없습니다.")
public record WeatherLocationResponse(boolean available, Integer gridX, Integer gridY,
                                      Instant updatedAt) {
    public static WeatherLocationResponse from(final MemberWeatherLocation location) {
        return new WeatherLocationResponse(location.isAvailable(), location.grid() == null ? null : location.grid().nx(),
                location.grid() == null ? null : location.grid().ny(), location.updatedAt());
    }
}
