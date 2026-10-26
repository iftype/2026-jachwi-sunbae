package com.jachwisunbae.weather.domain;

import java.time.LocalDate;

// tmn·tmx 자체가 null이면 해당 요소는 미수집이며 기존 저장값의 갱신 대상이 아니다.
public record DailyForecast(GridPoint point, LocalDate forecastDate, DailyTemperature tmn, DailyTemperature tmx) { }
