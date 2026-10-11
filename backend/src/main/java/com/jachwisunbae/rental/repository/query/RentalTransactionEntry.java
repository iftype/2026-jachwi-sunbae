package com.jachwisunbae.rental.repository.query;

import com.jachwisunbae.rental.domain.RentalTransaction;

public record RentalTransactionEntry(long rentalTransactionId, RentalTransaction transaction) {
}
