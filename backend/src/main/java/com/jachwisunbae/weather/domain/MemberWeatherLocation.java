package com.jachwisunbae.weather.domain;

import java.time.Instant;

public record MemberWeatherLocation(GridPoint grid, Instant observedAt, Instant syncedAt) {
    public boolean isAvailable() {
        return grid != null;
    }
}
