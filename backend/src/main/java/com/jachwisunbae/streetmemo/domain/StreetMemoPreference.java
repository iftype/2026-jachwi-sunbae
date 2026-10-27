package com.jachwisunbae.streetmemo.domain;

import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;

public enum StreetMemoPreference {
    LIKE,
    DISLIKE;

    public static StreetMemoPreference fromCode(final String code) {
        for (StreetMemoPreference preference : values()) {
            if (preference.name().equals(code)) {
                return preference;
            }
        }
        throw new InvalidInputException(ErrorCode.STREET_MEMO_PREFERENCE_INVALID,
                "거리 메모 선호는 LIKE 또는 DISLIKE여야 합니다.");
    }
}
