package com.jachwisunbae.weather.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.provider.kma.KmaGridConverter;
import com.jachwisunbae.weather.repository.WeatherForecastQueryRepository;
import com.jachwisunbae.weather.service.dto.result.WeatherForecastResult.Daily;
import com.jachwisunbae.weather.service.dto.result.WeatherForecastResult.Hour;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

class WeatherForecastQueryServiceTest {
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 25);
    private static final GridPoint GRID = new GridPoint(60, 127);
    private final WeatherForecastQueryRepository repository = mock(WeatherForecastQueryRepository.class);
    private final WeatherForecastQueryService service = new WeatherForecastQueryService(repository, new KmaGridConverter(),
            Clock.fixed(Instant.parse("2026-10-25T13:00:00Z"), ZoneOffset.UTC));

    @Test
    void fillsMissingHoursWithoutInventingZero() {
        var result = service.find(37.5665, 126.978, null);
        assertThat(result.grid()).isEqualTo(GRID);
        assertThat(result.date()).isEqualTo(TODAY);
        assertThat(result.hourly()).hasSize(24);
        assertThat(result.hourly()).allSatisfy(hour -> {
            assertThat(hour.tmp()).isNull();
            assertThat(hour.pty()).isNull();
            assertThat(hour.publishedAt()).isNull();
        });
        verify(repository).findHourly(GRID, TODAY);
        verify(repository).findDaily(GRID, TODAY);
    }

    @Test
    void preservesZeroMissingAndIndependentDailyPublications() {
        LocalDate tomorrow = TODAY.plusDays(1);
        var publication = TODAY.atTime(20, 0);
        when(repository.findHourly(GRID, tomorrow)).thenReturn(List.of(
                new Hour(tomorrow.atStartOfDay(), publication, -7.0, 1.0, 0.0, 0.0, 0.0, null, 60.0, 2.0)));
        when(repository.findDaily(GRID, tomorrow)).thenReturn(new Daily(0.0, 20.0, TODAY.atTime(2, 0), publication));
        var result = service.findByGrid(GRID, tomorrow);
        assertThat(result.hourly().getFirst().tmp()).isEqualTo(-7.0);
        assertThat(result.hourly().getFirst().pty()).isZero();
        assertThat(result.hourly().getFirst().sno()).isNull();
        assertThat(result.daily().tmn()).isZero();
        assertThat(result.daily().tmnPublishedAt()).isEqualTo(TODAY.atTime(2, 0));
        assertThat(result.daily().tmxPublishedAt()).isEqualTo(publication);
    }

    @Test
    void returnsCompletedForecastWithoutSixHourFreshnessLimit() {
        var publication = TODAY.minusDays(1).atTime(23, 0);
        when(repository.findHourly(GRID, TODAY)).thenReturn(List.of(
                new Hour(TODAY.atTime(23, 0), publication, 20.0, 1.0, 0.0, null, null, null, null, null)));
        var hour = service.findByGrid(GRID, TODAY).hourly().getLast();
        assertThat(hour.tmp()).isEqualTo(20.0);
        assertThat(hour.publishedAt()).isEqualTo(publication);
    }

    @Test
    void validatesCoordinatesBeforeReadingDatabase() {
        assertThatThrownBy(() -> service.find(Double.NaN, 127, TODAY)).isInstanceOf(InvalidInputException.class);
        verifyNoInteractions(repository);
    }

    @Test
    void usesKstDateAtUtcDateBoundary() {
        var boundary = new WeatherForecastQueryService(repository, new KmaGridConverter(),
                Clock.fixed(Instant.parse("2026-12-31T15:00:00Z"), ZoneOffset.UTC));
        assertThat(boundary.findByGrid(GRID, null).date()).isEqualTo(LocalDate.of(2027, 1, 1));
        assertThat(boundary.findByGrid(GRID, LocalDate.of(2027, 1, 2)).hourly()).hasSize(24);
    }
}
