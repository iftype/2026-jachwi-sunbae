package com.jachwisunbae.rental.domain;

// 원 단위 보증금과 월세의 금액 조건을 검증한다.
public record RentalPrice(long depositAmountKrw, long monthlyRentAmountKrw) {
    public RentalPrice {
        if (depositAmountKrw < 0 || monthlyRentAmountKrw <= 0) {
            throw new IllegalArgumentException("보증금은 0원 이상, 월세는 0원보다 커야 합니다.");
        }
    }
}
