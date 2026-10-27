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
@Tag(name = "Weather", description = "현재 위치의 날씨")
@SecurityRequirement(name = "bearerAuth")
public class WeatherForecastController {
    private final WeatherForecastQueryService service;

    public WeatherForecastController(final WeatherForecastQueryService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "현재 위치 날씨 조회", description = "DB의 완료 발표분만 조회합니다. date 생략 시 KST 오늘. "
            + "미수집·결측·미완료 값은 null이며 오래된 발표분도 반환할 수 있습니다. 좌표는 저장하지 않습니다. "
            + "400 좌표·입력 오류, 401 인증 오류.")
    public ApiResponse<WeatherForecastResponse> find(@RequestParam final double latitude,
                                                    @RequestParam final double longitude,
                                                    @Parameter(description = "KST 기준 조회 날짜, YYYY-MM-DD. 생략 시 오늘")
                                                    @RequestParam(required = false) final LocalDate date) {
        return ApiResponse.of(WeatherForecastResponse.from(service.find(latitude, longitude, date)));
    }
}
