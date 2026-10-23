package com.jachwisunbae.weather.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.provider.kma.ForecastFetchResult;
import com.jachwisunbae.weather.provider.kma.GridForecast;
import com.jachwisunbae.weather.provider.kma.GridValue;
import com.jachwisunbae.weather.provider.kma.KmaForecastClient;
import com.jachwisunbae.weather.provider.kma.KmaForecastRequest;
import com.jachwisunbae.weather.repository.JdbcWeatherForecastRepository;
import com.jachwisunbae.weather.service.dto.result.WeatherCollectionExecution.Source;
import com.jachwisunbae.weather.service.dto.result.WeatherCollectionExecution.Status;
import com.jachwisunbae.weather.service.dto.result.WeatherCollectionResult;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.transaction.PlatformTransactionManager;

class WeatherCollectionConcurrencyTest {

    private static final LocalDateTime PUBLICATION = LocalDateTime.of(2026, 10, 23, 2, 0);
    private static final Instant START = Instant.parse("2026-10-22T17:15:00Z");

    private final KmaForecastClient client = mock(KmaForecastClient.class);
    private final JdbcWeatherForecastRepository repository = mock(JdbcWeatherForecastRepository.class);
    private final Clock clock = mock(Clock.class);
    private final AtomicReference<Instant> now = new AtomicReference<>(START);
    private final WeatherCollectionService service = new WeatherCollectionService(client, repository,
            mock(PlatformTransactionManager.class), clock, true, 15);

    @BeforeEach
    void clock() {
        when(clock.instant()).thenAnswer(invocation -> now.get());
    }

    @ParameterizedTest
    @EnumSource(Source.class)
    @DisplayName("어느 진입점에서 수집하든 중첩 자동 실행은 건너뛰고 수동·최초 적재는 즉시 거부한다")
    void excludesEveryEntryPoint(final Source source) throws Exception {
        CountDownLatch entered = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        AtomicInteger requests = new AtomicInteger();
        when(client.fetchMeasured(any())).thenAnswer(invocation -> {
            if (requests.incrementAndGet() == 1) {
                entered.countDown();
                assertThat(release.await(5, TimeUnit.SECONDS)).isTrue();
            }
            return response(invocation.getArgument(0));
        });

        try (var executor = Executors.newSingleThreadExecutor()) {
            var collection = executor.submit(() -> switch (source) {
                case MANUAL -> service.collect(PUBLICATION);
                case INITIAL_LOAD -> service.initializeIfEmpty().orElseThrow();
                case SCHEDULED -> service.collectAutomatically().orElseThrow();
            });
            try {
                assertThat(entered.await(5, TimeUnit.SECONDS)).isTrue();
                var running = service.execution().orElseThrow();
                assertThat(running.status()).isEqualTo(Status.RUNNING);
                assertThat(running.source()).isEqualTo(source);
                assertThat(running.startedAt()).isEqualTo(START);
                assertThat(running.finishedAt()).isNull();

                assertThat(service.collectAutomatically()).isEmpty();
                assertThatThrownBy(() -> service.collect(PUBLICATION)).hasMessage("이미 날씨 수집이 실행 중입니다.");
                assertThatThrownBy(service::collectLatest).hasMessage("이미 날씨 수집이 실행 중입니다.");
                assertThatThrownBy(service::initializeIfEmpty).hasMessage("이미 날씨 수집이 실행 중입니다.");
                assertThat(service.execution()).contains(running);
                assertThat(requests.get()).isEqualTo(1);
                verify(repository, times(source == Source.INITIAL_LOAD ? 1 : 0)).hasValidHourlyForecastAtOrAfter(any());
            } finally {
                now.set(START.plusSeconds(60));
                release.countDown();
            }
            WeatherCollectionResult result = collection.get(5, TimeUnit.SECONDS);
            assertThat(result.requestCount()).isEqualTo(196);
            assertThat(service.execution().orElseThrow()).satisfies(completed -> {
                assertThat(completed.status()).isEqualTo(Status.SUCCEEDED);
                assertThat(completed.source()).isEqualTo(source);
                assertThat(completed.publishedAt()).isEqualTo(PUBLICATION);
                assertThat(completed.finishedAt()).isEqualTo(START.plusSeconds(60));
                assertThat(completed.elapsedNanos()).isPositive();
            });
        }
    }

    @Test
    @DisplayName("실패는 FAILED로 기록하고 잠금을 해제해 다음 발표분 실행을 허용한다")
    void releasesAfterFailure() {
        IllegalStateException failure = new IllegalStateException("test provider failure");
        when(client.fetchMeasured(any())).thenThrow(failure);
        assertThat(service.execution()).isEmpty();

        assertThatThrownBy(service::collectAutomatically).isSameAs(failure);

        assertThat(service.execution().orElseThrow().status()).isEqualTo(Status.FAILED);
        assertThat(service.execution().orElseThrow().finishedAt()).isEqualTo(START);
        doAnswer(invocation -> response(invocation.getArgument(0))).when(client).fetchMeasured(any());
        assertThat(service.collectAutomatically()).isPresent();
        assertThat(service.execution().orElseThrow().status()).isEqualTo(Status.SUCCEEDED);
    }

    @Test
    @DisplayName("초기 존재 검사 중에도 중첩 수집을 막고 건너뛰기 후에는 잠금을 해제한다")
    void includesInitializationCheckInExecution() throws Exception {
        CountDownLatch entered = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        when(repository.hasValidHourlyForecastAtOrAfter(any())).thenAnswer(invocation -> {
            entered.countDown();
            assertThat(release.await(5, TimeUnit.SECONDS)).isTrue();
            return true;
        });
        try (var executor = Executors.newSingleThreadExecutor()) {
            var initialization = executor.submit(service::initializeIfEmpty);
            try {
                assertThat(entered.await(5, TimeUnit.SECONDS)).isTrue();
                assertThat(service.collectAutomatically()).isEmpty();
                verify(client, times(0)).fetchMeasured(any());
            } finally {
                release.countDown();
            }
            assertThat(initialization.get(5, TimeUnit.SECONDS)).isEmpty();
            assertThat(service.execution().orElseThrow().status()).isEqualTo(Status.SKIPPED_VALID_FORECAST);
            when(client.fetchMeasured(any())).thenAnswer(invocation -> response(invocation.getArgument(0)));
            assertThat(service.collectAutomatically()).isPresent();
        }
    }

    private ForecastFetchResult response(final KmaForecastRequest request) {
        return new ForecastFetchResult(new GridForecast(request.times(), request.element(),
                List.of(new GridValue(new GridPoint(60, 127), 0))), 100, 10, 20);
    }
}
