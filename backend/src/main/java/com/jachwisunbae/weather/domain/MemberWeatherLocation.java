package com.jachwisunbae.weather.domain;

import java.time.Instant;

public record MemberWeatherLocation(GridPoint grid, Instant updatedAt) {
    public boolean isAvailable() {
        return grid != null;
    }
}
