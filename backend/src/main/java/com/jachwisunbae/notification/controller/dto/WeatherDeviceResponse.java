package com.jachwisunbae.notification.controller.dto;

import com.jachwisunbae.notification.domain.WeatherDevice;
import java.time.Instant;
import java.util.UUID;

public record WeatherDeviceResponse(UUID installationId, Instant updatedAt) {
    public static WeatherDeviceResponse from(final WeatherDevice device) {
        return new WeatherDeviceResponse(device.installationId(), device.updatedAt());
    }
}
