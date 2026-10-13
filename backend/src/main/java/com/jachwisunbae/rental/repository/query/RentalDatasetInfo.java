package com.jachwisunbae.rental.repository.query;

import java.time.Instant;
import java.time.LocalDate;

// 조회 응답에 사용할 수집본의 계약일 범위와 수집 시각을 전달한다.
public record RentalDatasetInfo(LocalDate datasetPeriodStart, LocalDate datasetPeriodEnd, Instant collectedAt) {
}
