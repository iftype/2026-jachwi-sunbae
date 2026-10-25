package com.jachwisunbae.weather.controller;

import com.jachwisunbae.common.web.ApiResponse;
import com.jachwisunbae.weather.controller.dto.WeatherForecastResponse;
import com.jachwisunbae.weather.service.WeatherForecastQueryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/weather/forecasts")
@Tag(name = "Weather", description = "현재 위치의 오늘·내일 날씨")
@SecurityRequirement(name = "bearerAuth")
public class WeatherForecastController {
    private final WeatherForecastQueryService service;

    public WeatherForecastController(final WeatherForecastQueryService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "현재 위치 날씨 조회", description = "인증된 회원의 위치를 격자로 변환해 MySQL에서 조회합니다. "
            + "date 생략 시 KST 오늘입니다. 빈 격자·미수집·결측은 200 응답의 상태로 구분합니다. "
            + "수집 미완료·미확인·오래된 값은 null로 반환합니다. "
            + "400: WEATHER_COORDINATE_INVALID, WEATHER_LOCATION_UNSUPPORTED, WEATHER_DATE_UNSUPPORTED, INVALID_REQUEST. "
            + "401: ACCESS_TOKEN_INVALID. 요청 좌표는 저장하지 않습니다.")
    public ApiResponse<WeatherForecastResponse> find(@RequestParam final double latitude,
                                                    @RequestParam final double longitude,
                                                    @Parameter(description = "KST 오늘 또는 내일, YYYY-MM-DD")
                                                    @RequestParam(required = false) final LocalDate date) {
        return ApiResponse.of(WeatherForecastResponse.from(service.find(latitude, longitude, date)));
    }
}
