package com.jachwisunbae.rental.domain;

public record RentalSource(String sourceFile, long sourceRowNumber) {
    public RentalSource {
        if (sourceFile.isBlank() || sourceFile.length() > 255 || sourceRowNumber <= 0) {
            throw new IllegalArgumentException("원본 파일과 행 번호가 올바르지 않습니다.");
        }
    }
}
