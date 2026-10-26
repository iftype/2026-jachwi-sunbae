package com.jachwisunbae.weather.domain;

import java.time.LocalDateTime;

// 같은 격자·발표·예보시각의 8개 요소를 결합한 예보다. null은 정상 응답의 격자 결측이다.
public record HourlyForecast(GridPoint point, ForecastTimes times,
                             Double tmp, Double sky, Double pty, Double pop,
                             Double pcp, Double sno, Double reh, Double wsd,
                             LocalDateTime collectedAt) { }
