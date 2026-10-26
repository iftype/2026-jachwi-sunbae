package com.jachwisunbae.weather.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class StoredForecastTest {

    private static final GridPoint POINT = new GridPoint(60, 127);
    private static final ForecastTimes TIMES = new ForecastTimes(LocalDateTime.of(2026, 10, 22, 23, 0),
            LocalDateTime.of(2026, 10, 23, 0, 0));
    private static final LocalDateTime COLLECTED_AT = TIMES.publishedAt().plusMinutes(15);
    private static final LocalDate DATE = LocalDate.of(2026, 10, 23);

    @Test
    @DisplayName("저장 모델은 음수·소수·0·NULL을 보존한다")
    void preservesRawValues() {
        HourlyForecast hourly = new HourlyForecast(POINT, TIMES, -7.25, 1.0, 0.0, 30.0,
                0.0, null, 65.0, 0.7, COLLECTED_AT);
        DailyTemperature missing = new DailyTemperature(null, TIMES.publishedAt(), COLLECTED_AT);
        DailyTemperature zero = new DailyTemperature(0.0, TIMES.publishedAt(), COLLECTED_AT);

        assertThat(hourly.tmp()).isEqualTo(-7.25);
        assertThat(hourly.wsd()).isEqualTo(0.7);
        assertThat(hourly.pty()).isZero();
        assertThat(hourly.sno()).isNull();
        assertThat(new DailyForecast(POINT, DATE, missing, null).tmn()).isEqualTo(missing);
        assertThat(new DailyForecast(POINT, DATE, missing, null).tmx()).isNull();
        assertThat(new DailyForecast(POINT, DATE, null, zero).tmx().value()).isZero();
    }

}
