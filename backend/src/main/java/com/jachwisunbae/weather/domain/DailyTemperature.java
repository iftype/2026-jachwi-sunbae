package com.jachwisunbae.weather.domain;

import java.time.LocalDateTime;

// 수집한 일별 기온 한 요소와 출처다. value가 null이어도 정상 결측의 발표·수집시각은 보존한다.
public record DailyTemperature(Double value, LocalDateTime publishedAt, LocalDateTime collectedAt) { }
