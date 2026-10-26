package com.jachwisunbae.notification.domain;

import java.time.Instant;
import java.util.UUID;

public record WeatherDevice(UUID installationId, long memberId, String secretHash, String token, Instant updatedAt) {
    @Override
    public String toString() {
        return "WeatherDevice[credentials=REDACTED]";
    }
}
