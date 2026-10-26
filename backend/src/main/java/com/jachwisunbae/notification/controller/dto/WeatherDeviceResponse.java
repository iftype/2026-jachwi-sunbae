package com.jachwisunbae.notification.controller.dto;

import com.jachwisunbae.notification.domain.WeatherDevice;
import java.time.Instant;
import java.util.UUID;

public record WeatherDeviceResponse(UUID installationId, String platform, String permission, boolean active, Instant updatedAt) {
    public static WeatherDeviceResponse from(final WeatherDevice device) {
        return new WeatherDeviceResponse(device.installationId(), device.platform().name(), device.permission().name(),
                device.active(), device.updatedAt());
    }
}
