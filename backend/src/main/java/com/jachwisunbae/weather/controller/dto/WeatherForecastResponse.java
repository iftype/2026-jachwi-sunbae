package com.jachwisunbae.weather.controller.dto;

import com.jachwisunbae.weather.service.dto.result.WeatherForecastResult;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

@Schema(description = "저장된 완료 발표분의 24시간 예보. 최신 기상청 발표를 보장하지 않으며 값이 없으면 null입니다.")
public record WeatherForecastResponse(int gridX, int gridY, LocalDate date, String timeZone,
                                      List<Hour> hourly, Double tmn, Double tmx,
                                      OffsetDateTime tmnPublishedAt, OffsetDateTime tmxPublishedAt) {
    public static WeatherForecastResponse from(final WeatherForecastResult result) {
        var daily = result.daily();
        return new WeatherForecastResponse(result.grid().nx(), result.grid().ny(), result.date(), "Asia/Seoul",
                result.hourly().stream().map(hour -> new Hour(kst(hour.forecastAt()), kst(hour.publishedAt()),
                        hour.tmp(), hour.sky(), hour.pty(), hour.pop(), hour.pcp(), hour.sno(), hour.reh(), hour.wsd())).toList(),
                daily.tmn(), daily.tmx(), kst(daily.tmnPublishedAt()), kst(daily.tmxPublishedAt()));
    }

    public record Hour(OffsetDateTime forecastAt, OffsetDateTime publishedAt,
                       Double tmp, Double sky, Double pty, Double pop, Double pcp, Double sno, Double reh, Double wsd) { }

    private static OffsetDateTime kst(final LocalDateTime time) {
        return time == null ? null : time.atOffset(ZoneOffset.ofHours(9));
    }
}
