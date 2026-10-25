package com.jachwisunbae.weather.notification.domain;

import java.time.Instant;
import java.util.UUID;

public record WeatherDelivery(UUID notificationId, UUID installationId, long registrationVersion, Status status,
                              int attempts, Instant nextAttemptAt, Instant claimedAt, Instant finishedAt,
                              String providerMessageId, String errorCode, Instant receivedAt, Instant openedAt) {
    public enum Status { PENDING, SENDING, ACCEPTED, RETRY, FAILED, UNKNOWN, CANCELLED }
}
