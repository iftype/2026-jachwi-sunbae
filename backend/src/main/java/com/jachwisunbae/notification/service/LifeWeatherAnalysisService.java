package com.jachwisunbae.notification.service;

import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.notification.domain.LifeWeatherForecast;
import com.jachwisunbae.notification.domain.LifeWeatherReport;
import com.jachwisunbae.notification.domain.LifeWeatherRules;
import com.jachwisunbae.notification.domain.NotificationSlot;
import com.jachwisunbae.weather.service.WeatherForecastQueryService;
import java.time.LocalDate;
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
        // 조회는 완료된 발표분만 반환한다. 생활 안내에 사용할 값의 범위·PTY 코드는 이 경계에서 한 번 확인한다.
        var hours = forecast.hourly().stream().filter(hour -> hour.forecastAt().getHour() >= slot.firstForecastHour())
                .map(hour -> new LifeWeatherForecast.Hour(hour.forecastAt(), temperature(hour.tmp()),
                        precipitationType(hour.pty()), between(hour.reh(), 0, 100))).toList();
        return rules.evaluate(new LifeWeatherForecast(forecast.date(), slot, hours,
                temperature(forecast.daily().tmn()), temperature(forecast.daily().tmx())));
    }

    private Double temperature(final Double value) {
        return between(value, -80, 60);
    }

    private Double precipitationType(final Double value) {
        Double valid = between(value, 0, 4);
        return valid != null && valid == Math.rint(valid) ? valid : null;
    }

    private Double between(final Double value, final double minimum, final double maximum) {
        return value != null && Double.isFinite(value) && value >= minimum && value <= maximum ? value : null;
    }
}
