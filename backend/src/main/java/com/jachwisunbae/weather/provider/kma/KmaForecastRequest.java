package com.jachwisunbae.weather.provider.kma;

import com.jachwisunbae.weather.domain.ForecastTimes;
import com.jachwisunbae.weather.domain.WeatherElement;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

public record KmaForecastRequest(ForecastTimes times, WeatherElement element) {

    private static final DateTimeFormatter FORMAT = DateTimeFormatter.ofPattern("uuuuMMddHH", Locale.ROOT);

    public String tmfc() {
        return times.publishedAt().format(FORMAT);
    }

    public String tmef() {
        return times.forecastAt().format(FORMAT);
    }
}
