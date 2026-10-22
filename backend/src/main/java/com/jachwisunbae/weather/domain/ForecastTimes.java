package com.jachwisunbae.weather.domain;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.time.temporal.ChronoUnit;

// RAW 본문에 없는 요청 메타데이터다. JVM 기본 시간대와 무관하게 두 시각을 KST로 해석한다.
public record ForecastTimes(LocalDateTime publishedAt, LocalDateTime forecastAt) {

    private static final DateTimeFormatter FORMAT = DateTimeFormatter.ofPattern("uuuuMMddHH")
            .withResolverStyle(ResolverStyle.STRICT);

    public ForecastTimes {
        if (publishedAt == null || forecastAt == null || forecastAt.isBefore(publishedAt)) {
            throw new IllegalArgumentException("발표 시각과 그 이후의 예보 대상 시각이 필요합니다.");
        }
        if (!publishedAt.equals(publishedAt.truncatedTo(ChronoUnit.HOURS))
                || !forecastAt.equals(forecastAt.truncatedTo(ChronoUnit.HOURS))) {
            throw new IllegalArgumentException("발표·예보 시각은 시간 단위여야 합니다.");
        }
    }

    public static ForecastTimes parse(final String publishedAt, final String forecastAt) {
        if (publishedAt == null || forecastAt == null
                || !publishedAt.matches("[0-9]{10}") || !forecastAt.matches("[0-9]{10}")) {
            throw new IllegalArgumentException("발표·예보 시각은 KST yyyyMMddHH 형식이어야 합니다.");
        }
        try {
            return new ForecastTimes(LocalDateTime.parse(publishedAt, FORMAT), LocalDateTime.parse(forecastAt, FORMAT));
        } catch (DateTimeParseException exception) {
            throw new IllegalArgumentException("발표·예보 시각에 유효한 날짜와 시간이 필요합니다.");
        }
    }

    public String tmfc() {
        return publishedAt.format(FORMAT);
    }

    public String tmef() {
        return forecastAt.format(FORMAT);
    }
}
