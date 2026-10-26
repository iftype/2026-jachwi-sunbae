package com.jachwisunbae.notification.provider.fcm;

import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import com.jachwisunbae.notification.provider.WeatherPushSender;

public class FirebaseWeatherPushSender implements WeatherPushSender {
    private final FirebaseMessaging messaging;

    public FirebaseWeatherPushSender(final FirebaseMessaging messaging) {
        this.messaging = messaging;
    }

    @Override
    public boolean send(final Push push) {
        Message message = Message.builder().setToken(push.token())
                .setNotification(Notification.builder().setTitle(push.title()).setBody(push.body()).build())
                .putData("notificationId", push.notificationId().toString()).build();
        try {
            messaging.send(message);
            return true;
        } catch (FirebaseMessagingException | RuntimeException exception) {
            // 외부 예외에 토큰이 포함될 수 있어 본문·cause를 전달하지 않는다.
            return false;
        }
    }
}
