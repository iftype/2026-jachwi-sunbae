package com.jachwisunbae.rental.repository.query;

import com.jachwisunbae.rental.domain.RentalTransaction;

/**
 * DB 거래 식별자와 복원한 거래 도메인 객체를 함께 전달한다.
 */
public record RentalTransactionEntry(long rentalTransactionId, RentalTransaction transaction) {
}
