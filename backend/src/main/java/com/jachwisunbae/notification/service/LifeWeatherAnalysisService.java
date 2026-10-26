package com.jachwisunbae.notification.service;

import com.jachwisunbae.weather.domain.ForecastValueStatus;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.WeatherElement;
import com.jachwisunbae.notification.domain.LifeWeatherForecast;
import com.jachwisunbae.notification.domain.LifeWeatherRules;
import com.jachwisunbae.notification.domain.NotificationSlot;
import com.jachwisunbae.notification.domain.LifeWeatherReport;
import com.jachwisunbae.weather.service.WeatherForecastQueryService;
import com.jachwisunbae.weather.service.dto.result.WeatherForecastResult;
import com.jachwisunbae.weather.service.dto.result.WeatherForecastResult.Reading;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.stereotype.Service;

// 알림 대상 날짜의 예보를 조회해, 알림 규칙(LifeWeatherRules)에 넣을 입력으로 바꾸고 평가 결과를 반환한다.
@Service
public class LifeWeatherAnalysisService {
    private final WeatherForecastQueryService forecasts;
    private final LifeWeatherRules rules = new LifeWeatherRules();

    public LifeWeatherAnalysisService(final WeatherForecastQueryService forecasts) {
        this.forecasts = forecasts;
    }

    public LifeWeatherReport analyze(final GridPoint grid, final LocalDate sendDate, final NotificationSlot slot) {
        // 아침 알림은 오늘, 저녁 알림은 내일 예보를 본다.
        var forecast = forecasts.findByGrid(grid, slot.targetDate(sendDate));
        // 아침 알림은 07시 이후, 저녁 알림은 하루 전체(00시~)만 분석한다.
        var hours = forecast.hourly().stream().filter(hour -> hour.forecastAt().getHour() >= slot.firstForecastHour()).toList();

        // 이 발표(아침: 당일 05시, 저녁: 당일 20시)보다 오래된 예보는 쓰지 않는다.
        LocalDateTime required = slot.requiredPublication(sendDate);
        // 분석할 모든 시각에서 기온(TMP)과 강수형태(PTY)가 둘 다 쓸 수 있어야 예보가 준비된 것으로 본다. 한 칸이라도 빠지면 false다.
        boolean verified = hours.stream().allMatch(hour -> List.of(WeatherElement.TMP, WeatherElement.PTY).stream()
                .allMatch(element -> usable(hour.values().get(element), required)));

        // 분석할 각 시각을 규칙 입력으로 바꾼다. 쓸 수 없는 값은 null이 된다.
        List<LifeWeatherForecast.Hour> ruleHours = hours.stream()
                .map(hour -> toRuleHour(hour, required))
                .toList();
        Double minimum = available(forecast.tmn());
        Double maximum = available(forecast.tmx());

        // 시간별 입력, 일 최저·최고기온, 준비 여부(verified)를 묶어 규칙으로 평가한다. 결과에 발송 여부와 문구가 담긴다.
        LifeWeatherForecast ruleInput = new LifeWeatherForecast(forecast.date(), slot, ruleHours, minimum, maximum, verified);
        return rules.evaluate(ruleInput);
    }

    // 생활 안내에 필요한 TMP·PTY·REH만 전달한다. 나머지 요소의 수집·일반 조회는 그대로 유지한다.
    private LifeWeatherForecast.Hour toRuleHour(final WeatherForecastResult.Hour hour, final LocalDateTime required) {
        return new LifeWeatherForecast.Hour(hour.forecastAt(),
                usableValue(hour.values().get(WeatherElement.TMP), required),
                usableValue(hour.values().get(WeatherElement.PTY), required),
                usableValue(hour.values().get(WeatherElement.REH), required));
    }

    private Double usableValue(final Reading reading, final LocalDateTime required) {
        return usable(reading, required) ? reading.value() : null;
    }

    // 정상 값(AVAILABLE)이면서 요구 발표 이후에 발표된 값만 쓸 수 있다.
    private boolean usable(final Reading reading, final LocalDateTime required) {
        return reading != null && reading.status() == ForecastValueStatus.AVAILABLE && reading.value() != null
                && reading.publishedAt() != null && !reading.publishedAt().isBefore(required);
    }

    // 최저·최고기온은 발표 시각 조건 없이 정상 값이면 사용한다.
    private Double available(final Reading reading) {
        return reading != null && reading.status() == ForecastValueStatus.AVAILABLE ? reading.value() : null;
    }
}
