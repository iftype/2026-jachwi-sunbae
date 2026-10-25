package com.jachwisunbae.weather.notification.provider;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.api.client.json.gson.GsonFactory;
import com.google.firebase.IncomingHttpResponse;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.MessagingErrorCode;
import com.jachwisunbae.weather.notification.provider.WeatherPushSender.Outcome;
import com.jachwisunbae.weather.notification.provider.WeatherPushSender.Push;
import com.jachwisunbae.weather.notification.provider.fcm.FirebaseWeatherPushSender;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;

class FirebaseWeatherPushSenderTest {
    private static final Instant NOW = Instant.parse("2026-10-24T22:00:00Z");
    private final FirebaseMessaging messaging = mock(FirebaseMessaging.class);
    private final FirebaseWeatherPushSender sender = new FirebaseWeatherPushSender(messaging, Clock.fixed(NOW, ZoneOffset.UTC));

    @Test
    void sendsOneCombinedMessageWithClickIdentityAndPlatformExpiration() throws Exception {
        var push = push(NOW.plusSeconds(3600));
        when(messaging.send(any(Message.class))).thenReturn("projects/test/messages/123");
        var result = sender.send(push);
        assertThat(result.outcome()).isEqualTo(Outcome.ACCEPTED);
        assertThat(result.providerMessageId()).isEqualTo("projects/test/messages/123");
        var captor = ArgumentCaptor.forClass(Message.class);
        verify(messaging).send(captor.capture());
        var json = new ObjectMapper().readTree(GsonFactory.getDefaultInstance().toString(captor.getValue()));
        assertThat(json.at("/token").asText()).isEqualTo(push.token());
        assertThat(json.at("/data/notificationId").asText()).isEqualTo(push.notificationId().toString());
        assertThat(json.at("/data/targetDate").asText()).isEqualTo("2026-10-25");
        assertThat(json.at("/android/ttl").asText()).isEqualTo("3600s");
        assertThat(json.at("/android/notification/tag").asText()).isEqualTo(push.notificationId().toString());
        assertThat(json.at("/apns/headers/apns-expiration").asText()).isEqualTo(Long.toString(push.expiresAt().getEpochSecond()));
        assertThat(json.get("data").toString()).doesNotContain("token", "grid", "member", "latitude", "longitude");
        assertThat(push.toString()).doesNotContain(push.token());
    }

    @ParameterizedTest
    @CsvSource({"UNREGISTERED,INVALID_TOKEN", "INVALID_ARGUMENT,REJECTED", "SENDER_ID_MISMATCH,REJECTED",
            "THIRD_PARTY_AUTH_ERROR,REJECTED", "QUOTA_EXCEEDED,RETRYABLE", "INTERNAL,UNKNOWN", "UNAVAILABLE,UNKNOWN"})
    void classifiesFailuresWithoutReturningProviderExceptionContents(final MessagingErrorCode code, final Outcome outcome) throws Exception {
        var error = mock(FirebaseMessagingException.class);
        when(error.getMessagingErrorCode()).thenReturn(code);
        when(messaging.send(any(Message.class))).thenThrow(error);
        var result = sender.send(push(NOW.plusSeconds(3600)));
        assertThat(result.outcome()).isEqualTo(outcome);
        assertThat(result.errorCode()).isEqualTo(code.name());
    }

    @ParameterizedTest
    @CsvSource({"1,60", "600,600", "7200,3600", "invalid,3600"})
    void quotaRetryRespectsRetryAfterWithoutExceedingSlot(final String header, final long seconds) throws Exception {
        var error = mock(FirebaseMessagingException.class);
        var response = mock(IncomingHttpResponse.class);
        when(error.getMessagingErrorCode()).thenReturn(MessagingErrorCode.QUOTA_EXCEEDED);
        when(error.getHttpResponse()).thenReturn(response);
        when(response.getHeaders()).thenReturn(Map.of("rEtRy-AfTeR", List.of(header)));
        when(messaging.send(any(Message.class))).thenThrow(error);
        assertThat(sender.send(push(NOW.plusSeconds(3600))).retryAfter()).isEqualTo(Duration.ofSeconds(seconds));
    }

    @Test
    void expiredMessageIsNotSentAndUnknownTransportResultIsNotBlindlyRetried() throws Exception {
        assertThat(sender.send(push(NOW)).errorCode()).isEqualTo("SLOT_EXPIRED");
        verifyNoInteractions(messaging);
        when(messaging.send(any(Message.class))).thenThrow(new IllegalStateException("sensitive-provider-response"));
        var result = sender.send(push(NOW.plusSeconds(3600)));
        assertThat(result.outcome()).isEqualTo(Outcome.UNKNOWN);
        assertThat(result.toString()).doesNotContain("sensitive-provider-response");
    }

    private Push push(final Instant expiry) {
        return new Push(UUID.randomUUID(), "fake-fcm-test-token-1234567890", "오늘 15시 비 예보", "우산을 준비하세요",
                "2026-10-25", "MORNING", expiry);
    }
}
