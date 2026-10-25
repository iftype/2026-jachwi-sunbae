package com.jachwisunbae.weather.notification.provider.fcm;

import com.google.firebase.messaging.AndroidConfig;
import com.google.firebase.messaging.AndroidNotification;
import com.google.firebase.messaging.ApnsConfig;
import com.google.firebase.messaging.Aps;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.MessagingErrorCode;
import com.google.firebase.messaging.Notification;
import com.jachwisunbae.weather.notification.provider.WeatherPushSender;
import java.time.Clock;
import java.time.Duration;
import java.util.List;

public class FirebaseWeatherPushSender implements WeatherPushSender {
    private final FirebaseMessaging messaging;
    private final Clock clock;

    public FirebaseWeatherPushSender(final FirebaseMessaging messaging, final Clock clock) {
        this.messaging = messaging;
        this.clock = clock;
    }

    @Override
    public Result send(final Push push) {
        long ttlMillis = Duration.between(clock.instant(), push.expiresAt()).toMillis();
        if (ttlMillis <= 0) {
            return Result.failed(Outcome.REJECTED, "SLOT_EXPIRED");
        }
        String key = push.notificationId().toString();
        Message message = Message.builder().setToken(push.token())
                .setNotification(Notification.builder().setTitle(push.title()).setBody(push.body()).build())
                .putData("type", "WEATHER").putData("notificationId", key)
                .putData("targetDate", push.targetDate()).putData("slot", push.slot())
                .setAndroidConfig(AndroidConfig.builder().setTtl(ttlMillis).setCollapseKey(key)
                        .setNotification(AndroidNotification.builder().setTag(key).build()).build())
                .setApnsConfig(ApnsConfig.builder().putHeader("apns-expiration", Long.toString(push.expiresAt().getEpochSecond()))
                        .putHeader("apns-collapse-id", key).setAps(Aps.builder().setSound("default").build()).build())
                .build();
        try {
            return Result.accepted(messaging.send(message));
        } catch (FirebaseMessagingException exception) {
            MessagingErrorCode code = exception.getMessagingErrorCode();
            if (code == MessagingErrorCode.UNREGISTERED) {
                return Result.failed(Outcome.INVALID_TOKEN, "UNREGISTERED");
            }
            if (code == MessagingErrorCode.QUOTA_EXCEEDED) {
                return new Result(Outcome.RETRYABLE, null, "QUOTA_EXCEEDED", retryDelay(exception));
            }
            if (code == MessagingErrorCode.INVALID_ARGUMENT || code == MessagingErrorCode.SENDER_ID_MISMATCH
                    || code == MessagingErrorCode.THIRD_PARTY_AUTH_ERROR) {
                return Result.failed(Outcome.REJECTED, code.name());
            }
            // 전송 후 응답만 유실됐을 수 있다. 예외 본문·토큰을 로그에 남기거나 무조건 재시도하지 않는다.
            return Result.failed(Outcome.UNKNOWN, code == null ? "TRANSPORT_OR_UNCLASSIFIED" : code.name());
        } catch (RuntimeException exception) {
            return Result.failed(Outcome.UNKNOWN, "PROVIDER_RUNTIME_ERROR");
        }
    }

    private Duration retryDelay(final FirebaseMessagingException exception) {
        if (exception.getHttpResponse() != null) {
            Object header = exception.getHttpResponse().getHeaders().entrySet().stream()
                    .filter(entry -> entry.getKey().equalsIgnoreCase("Retry-After")).map(entry -> entry.getValue()).findFirst().orElse(null);
            if (header != null) {
                String value = header instanceof List<?> values && !values.isEmpty() ? values.getFirst().toString() : header.toString();
                try {
                    return Duration.ofSeconds(Math.min(3600, Math.max(60, Long.parseLong(value))));
                } catch (NumberFormatException ignored) {
                    // HTTP 날짜 형식은 다음 재시도를 만료 이후로 미뤄 과도한 재요청을 막는다.
                    return Duration.ofHours(1);
                }
            }
        }
        return Duration.ofMinutes(5);
    }
}
