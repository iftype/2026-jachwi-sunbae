package com.jachwisunbae.weather.provider.kma;

import com.jachwisunbae.weather.domain.ForecastTimes;
import com.jachwisunbae.weather.domain.WeatherElement;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

// 전국 격자 API 호출 한 번에 필요한 요청 시각과 기상 요소다.
public record KmaForecastRequest(ForecastTimes times, WeatherElement element) {

    private static final DateTimeFormatter FORMAT = DateTimeFormatter.ofPattern("uuuuMMddHH", Locale.ROOT);

    public KmaForecastRequest {
        if (times == null || element == null) {
            throw new IllegalArgumentException("예보 요청에는 발표·대상 시각과 기상 요소가 필요합니다.");
        }
    }

    public String tmfc() {
        return times.publishedAt().format(FORMAT);
    }

    public String tmef() {
        return times.forecastAt().format(FORMAT);
    }
}
