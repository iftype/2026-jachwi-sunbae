package com.jachwisunbae.notification.provider;

import java.util.UUID;

public interface WeatherPushSender {
    boolean send(Push push);

    record Push(UUID notificationId, String token, String title, String body) {
        @Override
        public String toString() {
            return "WeatherPush[notificationId=" + notificationId + "]";
        }
    }
}
