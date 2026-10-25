package com.jachwisunbae.weather.notification.provider;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

public interface WeatherPushSender {
    Result send(Push push);

    record Push(UUID notificationId, String token, String title, String body, String targetDate, String slot, Instant expiresAt) {
        @Override
        public String toString() {
            return "WeatherPush[notificationId=" + notificationId + "]";
        }
    }

    enum Outcome { ACCEPTED, INVALID_TOKEN, REJECTED, RETRYABLE, UNKNOWN, DISABLED }

    record Result(Outcome outcome, String providerMessageId, String errorCode, Duration retryAfter) {
        public static Result accepted(final String providerMessageId) {
            return new Result(Outcome.ACCEPTED, providerMessageId, null, Duration.ZERO);
        }

        public static Result failed(final Outcome outcome, final String code) {
            return new Result(outcome, null, code, Duration.ofMinutes(5));
        }
    }
}
