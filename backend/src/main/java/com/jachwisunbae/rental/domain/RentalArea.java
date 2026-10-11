package com.jachwisunbae.rental.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * 제곱미터 면적과 면적 기준을 보관하고 소수 정밀도와 5~10평 범위를 검증한다.
 */
public record RentalArea(BigDecimal areaM2, AreaBasis areaBasis) {
    public RentalArea {
        areaM2 = areaM2.setScale(4, RoundingMode.UNNECESSARY);
        BigDecimal scaledArea = areaM2.multiply(BigDecimal.valueOf(121));
        if (scaledArea.compareTo(BigDecimal.valueOf(2000)) < 0
            || scaledArea.compareTo(BigDecimal.valueOf(4000)) > 0) {
            throw new IllegalArgumentException("면적은 5~10평 범위여야 합니다.");
        }
    }
}
