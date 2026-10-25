package com.jachwisunbae.weather.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.provider.kma.GridForecast;
import com.jachwisunbae.weather.provider.kma.GridValue;
import com.jachwisunbae.weather.provider.kma.KmaForecastClient;
import com.jachwisunbae.weather.provider.kma.KmaForecastRequest;
import com.jachwisunbae.weather.repository.JdbcWeatherForecastRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

class WeatherCollectionServiceTest {
    private final KmaForecastClient client = mock(KmaForecastClient.class);
    private final JdbcWeatherForecastRepository repository = mock(JdbcWeatherForecastRepository.class);
    private final LocalDateTime publication = LocalDateTime.of(2026, 10, 25, 5, 0);
    private final Clock clock = Clock.fixed(Instant.parse("2026-10-24T20:30:00Z"), ZoneOffset.UTC);
    private final WeatherCollectionService service = new WeatherCollectionService(client, repository, clock);

    @Test
    void failedRequiredElementDoesNotSaveAnIncompleteHourOrCompleteThePublication() {
        when(client.fetch(any())).thenAnswer(call -> {
            KmaForecastRequest request = call.getArgument(0);
            if (request.element() == com.jachwisunbae.weather.domain.WeatherElement.PTY) {
                throw new IllegalStateException("upstream failure");
            }
            return new GridForecast(request.times(), request.element(), List.of(new GridValue(new GridPoint(60, 127), 0.0)));
        });
        assertThatThrownBy(() -> service.collect(publication)).isInstanceOf(IllegalStateException.class);
        verify(repository).startCollection(publication, publication.plusMinutes(30));
        verify(repository, never()).upsertHourly(any());
        verify(repository, never()).completeCollection(any(), any());
    }

    @Test
    void invalidPublicationIsRejectedBeforeHttpOrStorage() {
        assertThatThrownBy(() -> service.collect(publication.plusMinutes(1))).isInstanceOf(IllegalArgumentException.class);
        org.mockito.Mockito.verifyNoInteractions(client, repository);
    }
}
