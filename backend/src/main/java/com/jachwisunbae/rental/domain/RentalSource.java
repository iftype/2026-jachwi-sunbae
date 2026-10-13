package com.jachwisunbae.rental.domain;

// 거래 출처를 추적할 원본 파일명과 행 번호를 검증한다.
public record RentalSource(String sourceFile, long sourceRowNumber) {
    public RentalSource {
        if (sourceFile.isBlank() || sourceFile.length() > 255 || sourceRowNumber <= 0) {
            throw new IllegalArgumentException("원본 파일과 행 번호가 올바르지 않습니다.");
        }
    }
}
