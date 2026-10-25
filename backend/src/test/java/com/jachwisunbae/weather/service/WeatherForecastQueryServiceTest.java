package com.jachwisunbae.weather.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.weather.domain.ForecastValueStatus;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.WeatherElement;
import com.jachwisunbae.weather.provider.kma.KmaGridConverter;
import com.jachwisunbae.weather.repository.WeatherForecastQueryRepository;
import com.jachwisunbae.weather.repository.WeatherForecastQueryRepository.StoredReading;
import com.jachwisunbae.weather.service.dto.result.WeatherForecastResult.Coverage;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class WeatherForecastQueryServiceTest {
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 25);
    private static final GridPoint GRID = new GridPoint(60, 127);
    private final WeatherForecastQueryRepository repository = mock(WeatherForecastQueryRepository.class);
    private final WeatherForecastQueryService service = new WeatherForecastQueryService(repository, new KmaGridConverter(),
            Clock.fixed(Instant.parse("2026-10-25T13:00:00Z"), ZoneOffset.UTC), 15);

    @Test
    void fillsMissingHoursWithoutInventingZeroOrLandCoverage() {
        var result = service.find(37.5665, 126.978, null);
        assertThat(result.grid()).isEqualTo(GRID);
        assertThat(result.date()).isEqualTo(TODAY);
        assertThat(result.hourly()).hasSize(24);
        assertThat(result.coverage()).isEqualTo(Coverage.UNAVAILABLE);
        assertThat(result.hourly().getFirst().values().get(WeatherElement.TMP).status())
                .isEqualTo(ForecastValueStatus.NOT_COLLECTED);
        assertThat(result.tmn().status()).isEqualTo(ForecastValueStatus.NOT_PROVIDED);
        verify(repository).findHourly(GRID, TODAY);
        verify(repository).findDaily(GRID, TODAY);
    }

    @Test
    void preservesZeroMissingAndDifferentDailyPublicationTimes() {
        LocalDateTime published = TODAY.atTime(20, 0);
        when(repository.findHourly(any(), any())).thenReturn(List.of(
                reading(TODAY.plusDays(1).atStartOfDay(), WeatherElement.TMP, 0.0, published),
                reading(TODAY.plusDays(1).atStartOfDay(), WeatherElement.SNO, null, published)));
        when(repository.findDaily(any(), any())).thenReturn(List.of(
                reading(TODAY.atStartOfDay(), WeatherElement.TMN, 0.0, TODAY.atTime(2, 0)),
                reading(TODAY.atStartOfDay(), WeatherElement.TMX, 20.0, TODAY.atTime(11, 0))));
        var tomorrow = service.findByGrid(GRID, TODAY.plusDays(1));
        assertThat(tomorrow.hourly().getFirst().values().get(WeatherElement.TMP).value()).isZero();
        assertThat(tomorrow.hourly().getFirst().values().get(WeatherElement.SNO).status()).isEqualTo(ForecastValueStatus.MISSING);
        assertThat(tomorrow.coverage()).isEqualTo(Coverage.PARTIAL);
        var today = service.findByGrid(GRID, TODAY);
        assertThat(today.tmn().status()).isEqualTo(ForecastValueStatus.AVAILABLE);
        assertThat(today.tmx().status()).isEqualTo(ForecastValueStatus.AVAILABLE);
        assertThat(today.tmn().publishedAt()).isEqualTo(TODAY.atTime(2, 0));
    }

    @Test
    void withholdsIncompleteLegacyRecollectionAndStaleValues() {
        LocalDateTime target = TODAY.atTime(23, 0);
        LocalDateTime published = TODAY.atTime(20, 0);
        when(repository.findHourly(any(), any())).thenReturn(List.of(
                new StoredReading(target, WeatherElement.TMP, 20.0, published, published.plusMinutes(20), null, null),
                new StoredReading(target, WeatherElement.SKY, 1.0, published, published.plusMinutes(20), published.plusHours(1), null),
                new StoredReading(target, WeatherElement.PTY, 1.0, published, published.plusMinutes(20),
                        published.plusMinutes(30), published.plusMinutes(40)),
                reading(target, WeatherElement.REH, 30.0, TODAY.atTime(11, 0))));
        var hour = service.findByGrid(GRID, TODAY).hourly().getLast();
        assertThat(hour.values().get(WeatherElement.TMP).status()).isEqualTo(ForecastValueStatus.UNVERIFIED);
        assertThat(hour.values().get(WeatherElement.SKY).status()).isEqualTo(ForecastValueStatus.UNVERIFIED);
        assertThat(hour.values().get(WeatherElement.PTY).status()).isEqualTo(ForecastValueStatus.UNVERIFIED);
        assertThat(hour.values().get(WeatherElement.REH).status()).isEqualTo(ForecastValueStatus.STALE);
        assertThat(hour.values().values()).allSatisfy(value -> assertThat(value.value()).isNull());
    }

    @Test
    void validatesDatesBeforeReadingDatabase() {
        for (LocalDate date : List.of(TODAY.minusDays(1), TODAY.plusDays(2))) {
            assertThatThrownBy(() -> service.findByGrid(GRID, date)).isInstanceOf(InvalidInputException.class);
        }
        assertThatThrownBy(() -> service.find(Double.NaN, 127, TODAY)).isInstanceOf(InvalidInputException.class);
        verifyNoInteractions(repository);
    }

    @Test
    void usesKstDateAtUtcDateBoundary() {
        var boundary = new WeatherForecastQueryService(repository, new KmaGridConverter(),
                Clock.fixed(Instant.parse("2026-12-31T15:00:00Z"), ZoneOffset.UTC), 15);
        assertThat(boundary.findByGrid(GRID, null).date()).isEqualTo(LocalDate.of(2027, 1, 1));
        assertThat(boundary.findByGrid(GRID, LocalDate.of(2027, 1, 2)).hourly()).hasSize(24);
    }

    @Test
    void recognizesCompleteTomorrowOnlyWhenAllElementsAreAvailable() {
        LocalDate tomorrow = TODAY.plusDays(1);
        LocalDateTime publication = TODAY.atTime(20, 0);
        when(repository.findHourly(GRID, tomorrow)).thenReturn(IntStream.range(0, 24)
                .boxed().flatMap(hour -> WeatherElement.hourlyElements().stream()
                        .map(element -> reading(tomorrow.atTime(hour, 0), element, 0.0, publication))).toList());
        when(repository.findDaily(GRID, tomorrow)).thenReturn(List.of(
                reading(tomorrow.atStartOfDay(), WeatherElement.TMN, 0.0, publication),
                reading(tomorrow.atStartOfDay(), WeatherElement.TMX, 0.0, publication)));
        assertThat(service.findByGrid(GRID, tomorrow).coverage()).isEqualTo(Coverage.AVAILABLE);
    }

    private StoredReading reading(final LocalDateTime target, final WeatherElement element,
                                  final Double value, final LocalDateTime publication) {
        return new StoredReading(target, element, value, publication, publication.plusMinutes(20),
                publication.plusMinutes(15), publication.plusMinutes(30));
    }

    @Test
    void acceptsSixHourLagButWithholdsEarlierOrFutureCompletedReadings() {
        LocalDateTime target = TODAY.atTime(23, 0);
        when(repository.findHourly(GRID, TODAY)).thenReturn(List.of(
                reading(target, WeatherElement.TMP, 20.0, TODAY.atTime(14, 0)),
                reading(target, WeatherElement.REH, 30.0, TODAY.atTime(11, 0)),
                reading(target, WeatherElement.SKY, 1.0, TODAY.atTime(23, 0)),
                new StoredReading(target, WeatherElement.PTY, 1.0, TODAY.atTime(20, 0), TODAY.atTime(20, 20),
                        TODAY.atTime(20, 15), TODAY.atTime(22, 1))));
        var values = service.findByGrid(GRID, TODAY).hourly().getLast().values();
        assertThat(values.get(WeatherElement.TMP).status()).isEqualTo(ForecastValueStatus.AVAILABLE);
        assertThat(values.get(WeatherElement.REH).status()).isEqualTo(ForecastValueStatus.STALE);
        assertThat(values.get(WeatherElement.SKY).status()).isEqualTo(ForecastValueStatus.UNVERIFIED);
        assertThat(values.get(WeatherElement.PTY).status()).isEqualTo(ForecastValueStatus.UNVERIFIED);
    }

    @Test
    void usesPublicationAtHistoricalHourInsteadOfMarkingAllMorningDataStaleAtNight() {
        when(repository.findHourly(GRID, TODAY)).thenReturn(List.of(
                reading(TODAY.atTime(7, 0), WeatherElement.TMP, 10.0, TODAY.atTime(5, 0))));
        assertThat(service.findByGrid(GRID, TODAY).hourly().get(7).values().get(WeatherElement.TMP).status())
                .isEqualTo(ForecastValueStatus.AVAILABLE);
    }
}
