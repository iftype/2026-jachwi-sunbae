package com.jachwisunbae.weather.domain;

import java.time.LocalDateTime;

// KST 발표·예보 시각. 요청 시각 검증은 수집 계획에서 수행한다.
public record ForecastTimes(LocalDateTime publishedAt, LocalDateTime forecastAt) { }
