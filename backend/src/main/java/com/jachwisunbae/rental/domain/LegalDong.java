package com.jachwisunbae.rental.domain;

// 거래를 집계할 공식 법정동 코드와 전체 이름을 검증한다.
public record LegalDong(String code, String name) {
    public LegalDong {
        if (!code.matches("[0-9]{10}") || name.isBlank()) {
            throw new IllegalArgumentException("법정동 코드 또는 이름이 올바르지 않습니다.");
        }
        if (name.length() > 150) {
            throw new IllegalArgumentException("거래 문자열의 길이가 저장 범위를 초과했습니다.");
        }
    }
}
