package com.jachwisunbae.bookmark.domain;

import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import java.util.regex.Pattern;

// 통계청 행정동 코드(8자리 숫자)다.
public record AdminDongCode(String value) {

    private static final Pattern FORMAT = Pattern.compile("\\d{8}");

    public AdminDongCode {
        if (value == null || !FORMAT.matcher(value).matches()) {
            throw new InvalidInputException(ErrorCode.ADMIN_DONG_BOOKMARK_INVALID, "행정동 코드는 8자리 숫자여야 합니다.");
        }
    }
}
