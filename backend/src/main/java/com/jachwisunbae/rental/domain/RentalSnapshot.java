package com.jachwisunbae.rental.domain;

import java.time.Instant;
import java.time.LocalDate;

// 전체 수집본의 범위 키, 파일 해시, 계약일 범위와 수집 시각을 검증한다.
public record RentalSnapshot(
    String datasetKey,
    String transactionSha256,
    String legalDongSha256,
    LocalDate datasetPeriodStart,
    LocalDate datasetPeriodEnd,
    Instant collectedAt
) {
    public static final String DATASET_KEY = "seoul-eastern-gyeonggi";

    public RentalSnapshot {
        if (!datasetKey.matches("[a-z0-9-]{1,64}")
            || !transactionSha256.matches("[a-f0-9]{64}") || !legalDongSha256.matches("[a-f0-9]{64}")) {
            throw new IllegalArgumentException("수집본 식별자 또는 SHA-256이 올바르지 않습니다.");
        }
        if (datasetPeriodStart.isAfter(datasetPeriodEnd) || datasetPeriodEnd.isAfter(datasetPeriodStart.plusMonths(6))) {
            throw new IllegalArgumentException("수집 기간은 6개월 이하여야 합니다.");
        }
        if (datasetPeriodEnd.isAfter(collectedAt.atOffset(java.time.ZoneOffset.ofHours(9)).toLocalDate())) {
            throw new IllegalArgumentException("수집 기간의 끝은 수집 시점보다 늦을 수 없습니다.");
        }
        if (collectedAt.getNano() % 1000 != 0) {
            throw new IllegalArgumentException("수집 시점은 마이크로초 이하 정밀도로 입력해야 합니다.");
        }
    }
}
