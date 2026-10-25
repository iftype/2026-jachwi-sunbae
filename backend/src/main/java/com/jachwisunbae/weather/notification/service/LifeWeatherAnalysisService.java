package com.jachwisunbae.weather.notification.service;

import com.jachwisunbae.weather.domain.ForecastValueStatus;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.WeatherElement;
import com.jachwisunbae.weather.notification.domain.LifeWeatherForecast;
import com.jachwisunbae.weather.notification.domain.LifeWeatherRules;
import com.jachwisunbae.weather.notification.domain.NotificationSlot;
import com.jachwisunbae.weather.notification.domain.LifeWeatherReport;
import com.jachwisunbae.weather.service.WeatherForecastQueryService;
import com.jachwisunbae.weather.service.dto.result.WeatherForecastResult.Reading;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class LifeWeatherAnalysisService {
    private final WeatherForecastQueryService forecasts;
    private final LifeWeatherRules rules = new LifeWeatherRules();

    public LifeWeatherAnalysisService(final WeatherForecastQueryService forecasts) {
        this.forecasts = forecasts;
    }

    public LifeWeatherReport analyze(final GridPoint grid, final LocalDate sendDate, final NotificationSlot slot) {
        var forecast = forecasts.findByGrid(grid, slot.targetDate(sendDate));
        var hours = forecast.hourly().stream().filter(hour -> hour.forecastAt().getHour() >= slot.firstForecastHour()).toList();
        LocalDateTime required = slot.requiredPublication(sendDate);
        boolean verified = hours.stream().allMatch(hour -> List.of(WeatherElement.TMP, WeatherElement.PTY).stream()
                .allMatch(element -> usable(hour.values().get(element), required)));
        List<LifeWeatherForecast.Hour> input = hours.stream().map(hour -> {
            Map<WeatherElement, Double> values = new EnumMap<>(WeatherElement.class);
            for (WeatherElement element : WeatherElement.hourlyElements()) {
                Reading reading = hour.values().get(element);
                values.put(element, usable(reading, required) ? reading.value() : null);
            }
            return new LifeWeatherForecast.Hour(hour.forecastAt(), values);
        }).toList();
        return rules.evaluate(new LifeWeatherForecast(forecast.date(), slot, input,
                available(forecast.tmn()), available(forecast.tmx()), verified));
    }

    private boolean usable(final Reading reading, final LocalDateTime required) {
        return reading != null && reading.status() == ForecastValueStatus.AVAILABLE && reading.value() != null
                && reading.publishedAt() != null && !reading.publishedAt().isBefore(required);
    }

    private Double available(final Reading reading) {
        return reading != null && reading.status() == ForecastValueStatus.AVAILABLE ? reading.value() : null;
    }
}
