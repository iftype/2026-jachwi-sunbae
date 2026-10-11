package com.jachwisunbae.rental.domain;

import java.util.Arrays;

/**
 * 지원하는 주택 유형을 정의하고 CSV의 원본 유형을 enum으로 변환한다.
 */
public enum HousingType {
    ROWHOUSE("연립다세대"),
    DETACHED("단독다가구"),
    OFFICETEL("오피스텔");

    private final String sourceValue;

    HousingType(final String sourceValue) {
        this.sourceValue = sourceValue;
    }

    public static HousingType fromSourceValue(final String sourceValue) {
        return Arrays.stream(values())
            .filter(housingType -> housingType.sourceValue.equals(sourceValue))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("알 수 없는 주택 유형입니다."));
    }
}
