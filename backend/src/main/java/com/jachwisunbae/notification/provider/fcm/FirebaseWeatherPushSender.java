package com.jachwisunbae.notification.provider.fcm;

import com.google.firebase.messaging.AndroidConfig;
import com.google.firebase.messaging.AndroidNotification;
import com.google.firebase.messaging.ApnsConfig;
import com.google.firebase.messaging.Aps;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import com.jachwisunbae.notification.provider.WeatherPushSender;
import java.time.Clock;
import java.time.Duration;

public class FirebaseWeatherPushSender implements WeatherPushSender {
    private final FirebaseMessaging messaging;
    private final Clock clock;

    public FirebaseWeatherPushSender(final FirebaseMessaging messaging, final Clock clock) {
        this.messaging = messaging;
        this.clock = clock;
    }

    @Override
    public boolean send(final Push push) {
        String key = push.notificationId().toString();
        Message message = Message.builder().setToken(push.token())
                .setNotification(Notification.builder().setTitle(push.title()).setBody(push.body()).build())
                .putData("type", "WEATHER").putData("notificationId", key)
                .putData("targetDate", push.targetDate()).putData("slot", push.slot())
                .setAndroidConfig(AndroidConfig.builder().setTtl(Duration.ofHours(1).toMillis()).setCollapseKey(key)
                        .setNotification(AndroidNotification.builder().setTag(key).build()).build())
                .setApnsConfig(ApnsConfig.builder().putHeader("apns-expiration", Long.toString(clock.instant().plusSeconds(3600).getEpochSecond()))
                        .putHeader("apns-collapse-id", key).setAps(Aps.builder().setSound("default").build()).build())
                .build();
        try {
            messaging.send(message);
            return true;
        } catch (FirebaseMessagingException | RuntimeException exception) {
            // 외부 예외에는 토큰이 들어갈 수 있으므로 본문이나 cause를 전달하지 않는다.
            return false;
        }
    }
}
