package com.jachwisunbae.rental.domain;

import java.util.Arrays;

public enum AreaBasis {
    EXCLUSIVE("exclusive"),
    CONTRACT("contract");

    private final String sourceValue;

    AreaBasis(final String sourceValue) {
        this.sourceValue = sourceValue;
    }

    public static AreaBasis fromSourceValue(final String sourceValue) {
        return Arrays.stream(values())
            .filter(areaBasis -> areaBasis.sourceValue.equals(sourceValue))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("알 수 없는 면적 기준입니다."));
    }
}
