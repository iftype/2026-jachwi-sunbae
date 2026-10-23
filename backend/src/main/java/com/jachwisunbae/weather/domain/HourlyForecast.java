package com.jachwisunbae.weather.domain;

import java.time.LocalDateTime;

// 같은 격자·발표·예보시각의 8개 요소를 결합한 예보다. null은 정상 응답의 격자 결측이다.
public record HourlyForecast(GridPoint point, ForecastTimes times,
                             Double tmp, Double sky, Double pty, Double pop,
                             Double pcp, Double sno, Double reh, Double wsd,
                             LocalDateTime collectedAt) {

    public HourlyForecast {
        if (point == null || times == null || collectedAt == null) {
            throw new IllegalArgumentException("시간별 예보의 격자·요청 시각·수집 시각이 필요합니다.");
        }
        for (Double value : new Double[]{tmp, sky, pty, pop, pcp, sno, reh, wsd}) {
            if (value != null && (!Double.isFinite(value) || value == -99.0 || value == -999.0)) {
                throw new IllegalArgumentException("기상 값은 유한한 원본 숫자 또는 결측을 나타내는 null이어야 합니다.");
            }
        }
    }
}
