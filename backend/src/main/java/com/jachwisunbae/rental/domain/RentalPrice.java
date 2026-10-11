package com.jachwisunbae.rental.domain;

public record RentalPrice(long depositAmountKrw, long monthlyRentAmountKrw) {
    public RentalPrice {
        if (depositAmountKrw < 0 || monthlyRentAmountKrw <= 0) {
            throw new IllegalArgumentException("보증금은 0원 이상, 월세는 0원보다 커야 합니다.");
        }
    }
}
