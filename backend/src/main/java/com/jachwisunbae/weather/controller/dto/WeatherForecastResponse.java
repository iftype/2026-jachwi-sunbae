package com.jachwisunbae.weather.controller.dto;

import com.jachwisunbae.weather.service.dto.result.WeatherForecastResult;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Schema(description = "KST 오늘 또는 내일 00~23시 예보. 값은 KMA RAW 수치이며 POP·PCP·SNO의 해석은 아직 미확인입니다.")
public record WeatherForecastResponse(int gridX, int gridY, LocalDate date, String timeZone,
                                      OffsetDateTime checkedAt, String coverage,
                                      List<Hour> hourly, Value tmn, Value tmx) {
    private static final ZoneOffset KST = ZoneOffset.ofHours(9);

    public static WeatherForecastResponse from(final WeatherForecastResult result) {
        return new WeatherForecastResponse(result.grid().nx(), result.grid().ny(), result.date(), "Asia/Seoul",
                result.checkedAt().atOffset(KST), result.coverage().name(), result.hourly().stream()
                .map(hour -> new Hour(hour.forecastAt().atOffset(KST), hour.values().entrySet().stream()
                        .collect(Collectors.toMap(entry -> entry.getKey().name(), entry -> Value.from(entry.getValue())))))
                .toList(), Value.from(result.tmn()), Value.from(result.tmx()));
    }

    public record Hour(OffsetDateTime forecastAt, Map<String, Value> values) { }

    public record Value(Double value,
                        @Schema(description = "AVAILABLE, MISSING, NOT_COLLECTED, NOT_PROVIDED, STALE, UNVERIFIED") String status,
                        OffsetDateTime publishedAt, OffsetDateTime collectedAt) {
        static Value from(final WeatherForecastResult.Reading reading) {
            return new Value(reading.value(), reading.status().name(),
                    reading.publishedAt() == null ? null : reading.publishedAt().atOffset(KST),
                    reading.collectedAt() == null ? null : reading.collectedAt().atOffset(KST));
        }
    }
}
