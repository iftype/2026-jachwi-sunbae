package com.jachwisunbae.weather.domain;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

// JVM 기본 시간대와 무관하게 KST 발표·예보 시각과 두 시각 사이의 불변 조건을 보관한다.
// 기상청이 발표한 예보의 시간, 그 예보가 설명하는 미래의 시각
public record ForecastTimes(LocalDateTime publishedAt, LocalDateTime forecastAt) {

    public ForecastTimes {
        if (publishedAt == null || forecastAt == null || forecastAt.isBefore(publishedAt)) {
            throw new IllegalArgumentException("발표 시각과 그 이후의 예보 대상 시각이 필요합니다.");
        }
        if (!publishedAt.equals(publishedAt.truncatedTo(ChronoUnit.HOURS))
                || !forecastAt.equals(forecastAt.truncatedTo(ChronoUnit.HOURS))) {
            throw new IllegalArgumentException("발표·예보 시각은 시간 단위여야 합니다.");
        }
    }
}
