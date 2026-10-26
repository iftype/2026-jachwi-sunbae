package com.jachwisunbae.notification.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.jachwisunbae.notification.domain.LifeWeatherReport.Condition;
import com.jachwisunbae.notification.domain.LifeWeatherReport.Notice;
import com.jachwisunbae.notification.domain.NotificationSlot;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.service.WeatherForecastQueryService;
import com.jachwisunbae.weather.service.dto.result.WeatherForecastResult;
import com.jachwisunbae.weather.service.dto.result.WeatherForecastResult.Daily;
import com.jachwisunbae.weather.service.dto.result.WeatherForecastResult.Hour;
import java.time.LocalDate;
import java.util.stream.IntStream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

class LifeWeatherAnalysisServiceTest {
    private static final LocalDate DATE = LocalDate.of(2026, 10, 25);
    private static final GridPoint GRID = new GridPoint(60, 127);
    private final WeatherForecastQueryService forecasts = mock(WeatherForecastQueryService.class);
    private final LifeWeatherAnalysisService service = new LifeWeatherAnalysisService(forecasts);

    @ParameterizedTest
    @CsvSource({"NULL,0", "NaN,0", "Infinity,0", "-99,0", "61,0", "15,NULL", "15,NaN", "15,Infinity",
            "15,-1", "15,5", "15,1.5"})
    void rejectsInvalidEssentialValuesAtAnalysisBoundary(final String temperature, final String pty) {
        stub(number(temperature), number(pty), 55.0, null, null);
        var report = service.analyze(GRID, DATE, NotificationSlot.MORNING);
        assertThat(report.sendable()).isFalse();
        assertThat(report.notices()).isEmpty();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(doubles = {-1, 101, Double.NaN, Double.POSITIVE_INFINITY})
    void invalidHumidityOnlyOmitsLaundry(final Double humidity) {
        stub(15.0, 0.0, humidity, null, null);
        var report = service.analyze(GRID, DATE, NotificationSlot.MORNING);
        assertThat(report.sendable()).isTrue();
        assertThat(report.notices()).isEmpty();
    }

    @ParameterizedTest
    @CsvSource({"-99,20", "NaN,20", "Infinity,20", "10,NaN", "10,Infinity", "10,61"})
    void invalidDailyValuesDoNotCreateColdOrSwingNotices(final String minimum, final String maximum) {
        stub(15.0, 0.0, 55.0, number(minimum), number(maximum));
        var report = service.analyze(GRID, DATE, NotificationSlot.MORNING);
        assertThat(report.sendable()).isTrue();
        assertThat(report.notices()).extracting(Notice::condition).containsExactly(Condition.LAUNDRY);
    }

    private void stub(final Double temperature, final Double pty, final Double humidity,
                      final Double minimum, final Double maximum) {
        var publication = DATE.minusDays(1).atTime(23, 0);
        var hours = IntStream.range(0, 24).mapToObj(hour -> new Hour(DATE.atTime(hour, 0), publication,
                hour == 9 ? temperature : Double.valueOf(15.0), 1.0, hour == 9 ? pty : Double.valueOf(0.0),
                0.0, 0.0, 0.0, hour == 9 ? humidity : Double.valueOf(55.0), 1.0)).toList();
        when(forecasts.findByGrid(GRID, DATE)).thenReturn(new WeatherForecastResult(GRID, DATE, hours,
                new Daily(minimum, maximum, publication, publication)));
    }

    private Double number(final String value) { return value.equals("NULL") ? null : Double.valueOf(value); }
}
