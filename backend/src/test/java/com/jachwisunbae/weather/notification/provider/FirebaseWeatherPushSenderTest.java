package com.jachwisunbae.weather.notification.provider;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.api.client.json.gson.GsonFactory;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.jachwisunbae.weather.notification.provider.WeatherPushSender.Push;
import com.jachwisunbae.weather.notification.provider.fcm.FirebaseWeatherPushSender;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class FirebaseWeatherPushSenderTest {
    private static final Instant NOW = Instant.parse("2026-10-24T22:00:00Z");
    private final FirebaseMessaging messaging = mock(FirebaseMessaging.class);
    private final FirebaseWeatherPushSender sender = new FirebaseWeatherPushSender(messaging, Clock.fixed(NOW, ZoneOffset.UTC));

    @Test
    void sendsOneCombinedMessageWithClickIdentityAndPlatformExpiration() throws Exception {
        var push = push();
        when(messaging.send(any(Message.class))).thenReturn("projects/test/messages/123");
        var result = sender.send(push);
        assertThat(result).isTrue();
        var captor = ArgumentCaptor.forClass(Message.class);
        verify(messaging).send(captor.capture());
        var json = new ObjectMapper().readTree(GsonFactory.getDefaultInstance().toString(captor.getValue()));
        assertThat(json.at("/token").asText()).isEqualTo(push.token());
        assertThat(json.at("/data/notificationId").asText()).isEqualTo(push.notificationId().toString());
        assertThat(json.at("/data/targetDate").asText()).isEqualTo("2026-10-25");
        assertThat(json.at("/android/ttl").asText()).isEqualTo("3600s");
        assertThat(json.at("/android/notification/tag").asText()).isEqualTo(push.notificationId().toString());
        assertThat(json.at("/apns/headers/apns-expiration").asText()).isEqualTo(Long.toString(NOW.plusSeconds(3600).getEpochSecond()));
        assertThat(json.get("data").toString()).doesNotContain("token", "grid", "member", "latitude", "longitude");
        assertThat(push.toString()).doesNotContain(push.token());
    }

    @Test
    void failedRequestIsReturnedWithoutRetryOrSensitiveExceptionText() throws Exception {
        when(messaging.send(any(Message.class))).thenThrow(new IllegalStateException("sensitive-provider-response"));
        var result = sender.send(push());
        assertThat(result).isFalse();
        verify(messaging).send(any(Message.class));
    }

    @Test
    void firebaseFailureIsNotRetried() throws Exception {
        when(messaging.send(any(Message.class))).thenThrow(mock(FirebaseMessagingException.class));
        assertThat(sender.send(push())).isFalse();
        verify(messaging).send(any(Message.class));
    }

    private Push push() {
        return new Push(UUID.randomUUID(), "fake-fcm-test-token-1234567890", "오늘 15시 비 예보", "우산을 준비하세요",
                "2026-10-25", "MORNING");
    }
}
