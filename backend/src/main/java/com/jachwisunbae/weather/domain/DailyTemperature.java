package com.jachwisunbae.weather.domain;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

// 수집한 일별 기온 한 요소와 출처다. value가 null이어도 정상 결측의 발표·수집시각은 보존한다.
public record DailyTemperature(Double value, LocalDateTime publishedAt, LocalDateTime collectedAt) {

    public DailyTemperature {
        if (publishedAt == null || collectedAt == null) {
            throw new IllegalArgumentException("수집한 일별 기온에는 발표·수집 시각이 필요합니다.");
        }
        if (!publishedAt.equals(publishedAt.truncatedTo(ChronoUnit.HOURS))) {
            throw new IllegalArgumentException("일별 기온의 발표 시각은 시간 단위여야 합니다.");
        }
        if (value != null && (!Double.isFinite(value) || value == -99.0 || value == -999.0)) {
            throw new IllegalArgumentException("일별 기온은 유한한 원본 숫자 또는 결측을 나타내는 null이어야 합니다.");
        }
    }
}
