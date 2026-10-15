package com.jachwisunbae.rental.domain;

import java.util.Arrays;

// 지원하는 주택 유형을 구분한다.
public enum HousingType {
    ROWHOUSE("연립다세대", AreaBasis.EXCLUSIVE),
    DETACHED("단독다가구", AreaBasis.CONTRACT),
    OFFICETEL("오피스텔", AreaBasis.EXCLUSIVE);

    private final String sourceValue;
    private final AreaBasis areaBasis;

    HousingType(final String sourceValue, final AreaBasis areaBasis) {
        this.sourceValue = sourceValue;
        this.areaBasis = areaBasis;
    }

    public AreaBasis areaBasis() {
        return areaBasis;
    }

    public static HousingType fromSourceValue(final String sourceValue) {
        return Arrays.stream(values())
            .filter(housingType -> housingType.sourceValue.equals(sourceValue))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("알 수 없는 주택 유형입니다."));
    }
}
