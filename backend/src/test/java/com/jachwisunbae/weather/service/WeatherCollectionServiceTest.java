package com.jachwisunbae.weather.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.provider.kma.ForecastFetchResult;
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
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionSynchronizationManager;

class WeatherCollectionServiceTest {

    private final KmaForecastClient client = mock(KmaForecastClient.class);
    private final JdbcWeatherForecastRepository repository = mock(JdbcWeatherForecastRepository.class);
    private final PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-10-22T17:30:00.123456789Z"), ZoneOffset.UTC);
    private final WeatherCollectionService service = new WeatherCollectionService(client, repository, transactions, clock);
    private final LocalDateTime publication = LocalDateTime.of(2026, 10, 23, 2, 0);

    @Test
    @DisplayName("요소 요청 실패는 일별 미제공으로 바꾸지 않고 현재 시각의 저장 전에 전파한다")
    void stopsBeforeWritingIncompleteHour() {
        AtomicInteger calls = new AtomicInteger();
        IllegalStateException failure = new IllegalStateException("test HTTP failure");
        when(client.fetchMeasured(any())).thenAnswer(invocation -> {
            if (calls.incrementAndGet() == 8) {
                throw failure;
            }
            return response(invocation.getArgument(0));
        });

        assertThatThrownBy(() -> service.collect(publication)).isSameAs(failure);

        assertThat(calls.get()).isEqualTo(8);
        verify(repository, never()).upsertHourly(any());
        verify(repository, never()).upsertDaily(any());
        verify(transactions, never()).getTransaction(any());
    }

    @Test
    @DisplayName("DB 실패 시 해당 저장을 롤백하고 다음 HTTP 요청을 시작하지 않는다")
    void stopsAfterDatabaseFailure() {
        AtomicInteger calls = new AtomicInteger();
        TransactionStatus status = mock(TransactionStatus.class);
        when(transactions.getTransaction(any())).thenReturn(status);
        when(client.fetchMeasured(any())).thenAnswer(invocation -> {
            calls.incrementAndGet();
            return response(invocation.getArgument(0));
        });
        IllegalStateException failure = new IllegalStateException("test DB failure");
        doThrow(failure).when(repository).upsertHourly(any());

        assertThatThrownBy(() -> service.collect(publication)).isSameAs(failure);

        assertThat(calls.get()).isEqualTo(8);
        verify(transactions).rollback(status);
        verify(transactions, never()).commit(any());
        verify(repository, never()).upsertDaily(any());
    }

    @Test
    @DisplayName("외부 트랜잭션 안에서는 수집을 시작하지 않는다")
    void rejectsOuterTransaction() {
        TransactionSynchronizationManager.setActualTransactionActive(true);
        try {
            assertThatThrownBy(() -> service.collect(publication)).isInstanceOf(IllegalStateException.class);
            verify(client, never()).fetchMeasured(any());
        } finally {
            TransactionSynchronizationManager.setActualTransactionActive(false);
        }
    }

    private ForecastFetchResult response(final KmaForecastRequest request) {
        return new ForecastFetchResult(new GridForecast(request.times(), request.element(),
                List.of(new GridValue(new GridPoint(60, 127), 0))), 100, 10, 20);
    }
}
