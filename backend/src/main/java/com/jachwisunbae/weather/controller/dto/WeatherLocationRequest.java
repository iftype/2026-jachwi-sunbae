package com.jachwisunbae.weather.controller.dto;

import jakarta.validation.constraints.NotNull;

public record WeatherLocationRequest(@NotNull Double latitude, @NotNull Double longitude) {
}
