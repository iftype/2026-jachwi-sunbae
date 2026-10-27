package com.jachwisunbae.streetmemo.domain;

import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import java.math.BigDecimal;

record StreetMemoLocation(BigDecimal latitude, BigDecimal longitude) {

    private static final BigDecimal MAX_LATITUDE = BigDecimal.valueOf(90);
    private static final BigDecimal MAX_LONGITUDE = BigDecimal.valueOf(180);

    StreetMemoLocation {
        validateCoordinate(latitude, MAX_LATITUDE, "거리 메모 위도는 -90 이상 90 이하여야 합니다.");
        validateCoordinate(longitude, MAX_LONGITUDE, "거리 메모 경도는 -180 이상 180 이하여야 합니다.");
    }

    private static void validateCoordinate(final BigDecimal coordinate, final BigDecimal limit,
                                           final String message) {
        if (coordinate == null || coordinate.abs().compareTo(limit) > 0) {
            throw new InvalidInputException(ErrorCode.STREET_MEMO_LOCATION_INVALID, message);
        }
    }
}
