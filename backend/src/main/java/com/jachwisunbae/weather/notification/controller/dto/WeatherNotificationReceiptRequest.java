package com.jachwisunbae.weather.notification.controller.dto;

import jakarta.validation.constraints.NotNull;

public record WeatherNotificationReceiptRequest(@NotNull Receipt status) {
    public enum Receipt { RECEIVED, OPENED }
}
