package com.jachwisunbae.weather.service;

import com.jachwisunbae.weather.repository.JdbcWeatherForecastRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WeatherCleanupService {
    private static final Logger LOG = LoggerFactory.getLogger(WeatherCleanupService.class);
    private final JdbcWeatherForecastRepository repository;
    private final Clock clock;

    public WeatherCleanupService(final JdbcWeatherForecastRepository repository, final Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Transactional
    public void cleanup() {
        LocalDate today = LocalDate.ofInstant(clock.instant(), ZoneId.of("Asia/Seoul"));
        int hourly = repository.deleteHourlyBefore(today.atStartOfDay());
        int daily = repository.deleteDailyBefore(today);
        LOG.info("weather-cleanup retainedFrom={} hourlyDeleted={} dailyDeleted={}", today, hourly, daily);
    }
}
