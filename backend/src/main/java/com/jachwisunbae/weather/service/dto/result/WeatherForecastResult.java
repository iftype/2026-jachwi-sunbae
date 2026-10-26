package com.jachwisunbae.weather.service.dto.result;

import com.jachwisunbae.weather.domain.GridPoint;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record WeatherForecastResult(GridPoint grid, LocalDate date, List<Hour> hourly, Daily daily) {
    public record Hour(LocalDateTime forecastAt, LocalDateTime publishedAt,
                       Double tmp, Double sky, Double pty, Double pop, Double pcp, Double sno, Double reh, Double wsd) {
        public static Hour missing(final LocalDateTime at) {
            return new Hour(at, null, null, null, null, null, null, null, null, null);
        }
    }

    public record Daily(Double tmn, Double tmx, LocalDateTime tmnPublishedAt, LocalDateTime tmxPublishedAt) { }
}
