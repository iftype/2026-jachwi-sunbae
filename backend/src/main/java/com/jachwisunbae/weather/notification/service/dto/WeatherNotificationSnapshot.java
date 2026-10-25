package com.jachwisunbae.weather.notification.service.dto;

import com.jachwisunbae.weather.notification.domain.LifeWeatherReport;
import com.jachwisunbae.weather.service.dto.result.WeatherForecastResult;

public record WeatherNotificationSnapshot(String policyVersion, boolean precipitationContractVerified,
                                           WeatherForecastResult forecast, LifeWeatherReport report) {
}
