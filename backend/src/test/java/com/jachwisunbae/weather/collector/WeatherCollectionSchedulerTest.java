package com.jachwisunbae.weather.collector;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.jachwisunbae.weather.service.WeatherCollectionService;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class WeatherCollectionSchedulerTest {
    @Test
    void selectsTheKstPublicationEvenWithAUtcClock() {
        WeatherCollectionService service = mock(WeatherCollectionService.class);
        new WeatherCollectionScheduler(service, Clock.fixed(Instant.parse("2026-12-31T17:15:00Z"), ZoneOffset.UTC)).collect();
        verify(service).collect(LocalDateTime.of(2027, 1, 1, 2, 0));
    }
}
