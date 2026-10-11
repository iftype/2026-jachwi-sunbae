package com.jachwisunbae.rental.domain;

import java.util.Arrays;
import java.util.Set;

public enum ContractType {
    NEW("신규"),
    RENEWAL("갱신"),
    UNKNOWN("-", "");

    private final Set<String> sourceValues;

    ContractType(final String... sourceValues) {
        this.sourceValues = Set.of(sourceValues);
    }

    public static ContractType fromSourceValue(final String sourceValue) {
        return Arrays.stream(values())
            .filter(contractType -> sourceValue != null && contractType.sourceValues.contains(sourceValue))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("알 수 없는 계약 구분입니다."));
    }
}
