package com.jachwisunbae.notification.controller.dto;

import jakarta.validation.constraints.NotNull;

public record WeatherNotificationSettingsRequest(@NotNull Boolean enabled) { }
