package com.jachwisunbae.rental.domain;

import java.time.LocalDate;
import java.util.Objects;

// 월세 실거래 한 건을 구성하고 주택 유형과 면적 기준 등을 검증한다.
public record RentalTransaction(
    LegalDong legalDong,
    HousingType housingType,
    RentalPrice price,
    RentalArea area,
    LocalDate contractDate,
    ContractType contractType,
    String buildingName,
    String floor,
    String contractPeriod,
    RentalSource source
) {
    public RentalTransaction {
        Objects.requireNonNull(legalDong);
        Objects.requireNonNull(housingType);
        Objects.requireNonNull(price);
        Objects.requireNonNull(area);
        Objects.requireNonNull(source);
        Objects.requireNonNull(contractType);
        if (housingType.areaBasis() != area.areaBasis()) {
            throw new IllegalArgumentException("주택 유형과 면적 기준이 일치하지 않습니다.");
        }
        if (buildingName.length() > 255
            || floor.length() > 20 || contractPeriod.length() > 40) {
            throw new IllegalArgumentException("거래 문자열의 길이가 저장 범위를 초과했습니다.");
        }
    }
}
