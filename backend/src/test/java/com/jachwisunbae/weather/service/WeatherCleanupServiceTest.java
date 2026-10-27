package com.jachwisunbae.weather.service;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.jachwisunbae.weather.repository.JdbcWeatherForecastRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class WeatherCleanupServiceTest {
    @Test
    void calculatesOneKstCutoffEvenWhenExecutionCrossesMidnight() {
        Clock clock = mock(Clock.class);
        when(clock.instant()).thenReturn(Instant.parse("2026-12-31T14:59:59Z"), Instant.parse("2026-12-31T15:00:00Z"));
        JdbcWeatherForecastRepository repository = mock(JdbcWeatherForecastRepository.class);
        new WeatherCleanupService(repository, clock).cleanup();
        LocalDate cutoff = LocalDate.of(2026, 12, 31);
        verify(repository).deleteHourlyBefore(cutoff.atStartOfDay());
        verify(repository).deleteDailyBefore(cutoff);
        verify(clock).instant();
    }
}
