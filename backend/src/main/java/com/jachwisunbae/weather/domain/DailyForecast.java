package com.jachwisunbae.weather.domain;

import java.time.LocalDate;

// tmn·tmx 자체가 null이면 해당 요소는 미수집이며 기존 저장값의 갱신 대상이 아니다.
public record DailyForecast(GridPoint point, LocalDate forecastDate, DailyTemperature tmn, DailyTemperature tmx) {

    public DailyForecast {
        if (point == null || forecastDate == null || (tmn == null && tmx == null)) {
            throw new IllegalArgumentException("일별 예보의 격자·대상 날짜와 하나 이상의 수집 결과가 필요합니다.");
        }
        if ((tmn != null && tmn.publishedAt().toLocalDate().isAfter(forecastDate))
                || (tmx != null && tmx.publishedAt().toLocalDate().isAfter(forecastDate))) {
            throw new IllegalArgumentException("일별 기온의 대상 날짜는 발표일보다 이전일 수 없습니다.");
        }
    }
}
