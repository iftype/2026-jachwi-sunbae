package com.jachwisunbae.notification.domain;

import java.time.Instant;
import java.util.UUID;

public record WeatherDevice(UUID installationId, long memberId, String secretHash, String token,
                            Platform platform, Permission permission, boolean active, Instant updatedAt) {
    public enum Platform { ANDROID, IOS }
    public enum Permission { GRANTED, DENIED }

    @Override
    public String toString() {
        return "WeatherDevice[credentials=REDACTED]";
    }
}
