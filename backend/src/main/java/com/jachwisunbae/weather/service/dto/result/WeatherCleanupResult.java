package com.jachwisunbae.weather.service.dto.result;

import java.time.Instant;
import java.time.LocalDate;

public record WeatherCleanupResult(LocalDate retainedFrom, Instant startedAt, Instant finishedAt,
                                   TableCleanup hourly, TableCleanup daily, long elapsedNanos) {

    public record TableCleanup(long beforeRows, long deletedRows, long afterRows) {
    }
}
