package com.jachwisunbae.rental.repository.query;

import java.time.Instant;
import java.time.LocalDate;

public record RentalDatasetInfo(LocalDate datasetPeriodStart, LocalDate datasetPeriodEnd, Instant collectedAt) {
}
