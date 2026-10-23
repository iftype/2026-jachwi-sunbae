package com.jachwisunbae.weather.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.provider.kma.ForecastFetchResult;
import com.jachwisunbae.weather.provider.kma.GridForecast;
import com.jachwisunbae.weather.provider.kma.GridValue;
import com.jachwisunbae.weather.provider.kma.KmaForecastClient;
import com.jachwisunbae.weather.provider.kma.KmaForecastRequest;
import com.jachwisunbae.weather.repository.JdbcWeatherForecastRepository;
import com.jachwisunbae.weather.service.dto.result.WeatherCollectionResult;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronizationManager;

class WeatherCollectionInitializationTest {

    private static final Instant NOW = Instant.parse("2026-10-22T17:20:00Z");
    private static final LocalDateTime NOW_KST = LocalDateTime.of(2026, 10, 23, 2, 20);
    private static final LocalDateTime PUBLICATION = LocalDateTime.of(2026, 10, 23, 2, 0);

    private final KmaForecastClient client = mock(KmaForecastClient.class);
    private final JdbcWeatherForecastRepository repository = mock(JdbcWeatherForecastRepository.class);
    private final PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);

    @Test
    @DisplayName("초기 적재가 OFF이면 DB 조회와 HTTP 요청 전에 거부한다")
    void rejectsWhenDisabled() {
        assertThatThrownBy(() -> service(false, ZoneOffset.UTC).initializeIfEmpty())
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("weather.initial-load.enabled=true");

        verifyNoInteractions(repository, client, transactions);
    }

    @Test
    @DisplayName("현재 이후의 유효 예보가 있으면 최초 적재를 건너뛰며 재수집하지 않는다")
    void skipsWhenValidForecastExists() {
        when(repository.hasValidHourlyForecastAtOrAfter(NOW_KST)).thenReturn(true);

        assertThat(service(true, ZoneOffset.UTC).initializeIfEmpty()).isEmpty();

        verify(repository).hasValidHourlyForecastAtOrAfter(NOW_KST);
        verifyNoInteractions(client, transactions);
        verify(repository, never()).upsertHourly(any());
        verify(repository, never()).upsertDaily(any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"UTC", "America/Los_Angeles"})
    @DisplayName("유효 예보가 없으면 Clock의 시간대와 무관하게 KST 최신 발표분의 시간별·일별 예보를 수집한다")
    void initializesUsingSharedCollection(final String clockZone) {
        respondSuccessfully();

        WeatherCollectionResult result = service(true, ZoneId.of(clockZone)).initializeIfEmpty().orElseThrow();

        assertThat(result.publishedAt()).isEqualTo(PUBLICATION);
        assertThat(result.requestCount()).isEqualTo(196);
        assertThat(result.hourlyRows()).isEqualTo(24);
        assertThat(result.dailyRows()).isEqualTo(2);
        assertThat(result.requests()).allSatisfy(measurement ->
                assertThat(measurement.request().times().publishedAt()).isEqualTo(PUBLICATION));
        verify(repository).hasValidHourlyForecastAtOrAfter(NOW_KST);
        verify(repository, times(24)).upsertHourly(any());
        verify(repository, times(2)).upsertDaily(any());
        verify(transactions, times(26)).commit(any());
    }

    @Test
    @DisplayName("최신 발표분 수집은 초기 적재 설정·DB 존재 검사와 독립적으로 같은 수집 경로를 사용한다")
    void collectsLatestWithoutInitializationGate() {
        respondSuccessfully();

        WeatherCollectionResult result = service(false, ZoneOffset.UTC).collectLatest();

        assertThat(result.publishedAt()).isEqualTo(PUBLICATION);
        assertThat(result.requestCount()).isEqualTo(196);
        verify(repository, never()).hasValidHourlyForecastAtOrAfter(any());
    }

    @Test
    @DisplayName("최초 적재 중 미공개·실패 응답은 빈 결과나 성공으로 바꾸지 않고 전파한다")
    void propagatesCollectionFailure() {
        IllegalStateException failure = new IllegalStateException("test provider failure");
        when(client.fetchMeasured(any())).thenThrow(failure);

        assertThatThrownBy(() -> service(true, ZoneOffset.UTC).initializeIfEmpty()).isSameAs(failure);

        verify(repository, never()).upsertHourly(any());
        verify(repository, never()).upsertDaily(any());
        verifyNoInteractions(transactions);
    }

    @Test
    @DisplayName("존재 검사 중 DB 오류를 빈 DB로 간주해 수집하지 않는다")
    void propagatesExistenceCheckFailure() {
        IllegalStateException failure = new IllegalStateException("test DB failure");
        when(repository.hasValidHourlyForecastAtOrAfter(any())).thenThrow(failure);

        assertThatThrownBy(() -> service(true, ZoneOffset.UTC).initializeIfEmpty()).isSameAs(failure);

        verifyNoInteractions(client, transactions);
    }

    @Test
    @DisplayName("외부 트랜잭션 안에서 최초 적재를 호출하면 존재 검사 전 거부한다")
    void rejectsOuterTransaction() {
        TransactionSynchronizationManager.setActualTransactionActive(true);
        try {
            assertThatThrownBy(() -> service(true, ZoneOffset.UTC).initializeIfEmpty())
                    .isInstanceOf(IllegalStateException.class).hasMessageContaining("외부 DB 트랜잭션");
            verifyNoInteractions(repository, client, transactions);
        } finally {
            TransactionSynchronizationManager.setActualTransactionActive(false);
        }
    }

    private WeatherCollectionService service(final boolean enabled, final ZoneId clockZone) {
        return new WeatherCollectionService(client, repository, transactions, Clock.fixed(NOW, clockZone), enabled, 15);
    }

    private void respondSuccessfully() {
        when(client.fetchMeasured(any())).thenAnswer(invocation -> {
            KmaForecastRequest request = invocation.getArgument(0);
            GridForecast forecast = new GridForecast(request.times(), request.element(),
                    List.of(new GridValue(new GridPoint(60, 127), 0)));
            return new ForecastFetchResult(forecast, 100, 10, 5);
        });
    }
}
