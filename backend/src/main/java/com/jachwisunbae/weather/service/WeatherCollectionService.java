package com.jachwisunbae.weather.service;

import com.jachwisunbae.weather.domain.DailyForecast;
import com.jachwisunbae.weather.domain.ForecastTimes;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.HourlyForecast;
import com.jachwisunbae.weather.provider.kma.ForecastFetchResult;
import com.jachwisunbae.weather.provider.kma.GridForecast;
import com.jachwisunbae.weather.provider.kma.KmaForecastClient;
import com.jachwisunbae.weather.provider.kma.KmaForecastRequest;
import com.jachwisunbae.weather.repository.JdbcWeatherForecastRepository;
import com.jachwisunbae.weather.service.collection.DailyForecastAssembler;
import com.jachwisunbae.weather.service.collection.HourlyForecastAssembler;
import com.jachwisunbae.weather.service.collection.WeatherCollectionPlan;
import com.jachwisunbae.weather.service.collection.WeatherPublicationSchedule;
import com.jachwisunbae.weather.service.dto.result.WeatherCollectionExecution;
import com.jachwisunbae.weather.service.dto.result.WeatherCollectionExecution.Source;
import com.jachwisunbae.weather.service.dto.result.WeatherCollectionExecution.Status;
import com.jachwisunbae.weather.service.dto.result.WeatherCollectionResult;
import com.jachwisunbae.weather.service.dto.result.WeatherCollectionResult.RequestMeasurement;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class WeatherCollectionService {

    private static final Logger LOG = LoggerFactory.getLogger(WeatherCollectionService.class);
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final KmaForecastClient client;
    private final JdbcWeatherForecastRepository repository;
    private final TransactionTemplate transaction;
    private final Clock clock;
    private final boolean initialLoadEnabled;
    private final WeatherPublicationSchedule publicationSchedule;
    private final HourlyForecastAssembler hourlyAssembler = new HourlyForecastAssembler();
    private final DailyForecastAssembler dailyAssembler = new DailyForecastAssembler();
    private final AtomicBoolean running = new AtomicBoolean();
    private volatile WeatherCollectionExecution execution;

    public WeatherCollectionService(final KmaForecastClient client, final JdbcWeatherForecastRepository repository,
                                    final PlatformTransactionManager transactionManager, final Clock clock,
                                    @Value("${weather.initial-load.enabled:false}") final boolean initialLoadEnabled,
                                    @Value("${weather.collection.publication-delay-minutes:15}") final long publicationDelayMinutes) {
        this.client = client;
        this.repository = repository;
        this.transaction = new TransactionTemplate(transactionManager);
        this.clock = clock;
        this.initialLoadEnabled = initialLoadEnabled;
        this.publicationSchedule = new WeatherPublicationSchedule(Duration.ofMinutes(publicationDelayMinutes));
    }

    public WeatherCollectionResult collectLatest() {
        return execute(Source.MANUAL, latestPublication()).orElseThrow();
    }

    // 자동 실행은 중첩되면 기다리지 않고 건너뛴다. 실패는 그대로 전파한다.
    public Optional<WeatherCollectionResult> collectAutomatically() {
        return execute(Source.SCHEDULED, latestPublication());
    }

    public Optional<WeatherCollectionResult> initializeIfEmpty() {
        if (!initialLoadEnabled) {
            throw new IllegalStateException("최초 적재는 weather.initial-load.enabled=true 설정이 필요합니다.");
        }
        return execute(Source.INITIAL_LOAD, latestPublication());
    }

    public WeatherCollectionResult collect(final LocalDateTime publishedAt) {
        return execute(Source.MANUAL, publishedAt).orElseThrow();
    }

    public Optional<WeatherCollectionExecution> execution() {
        return Optional.ofNullable(execution);
    }

    private LocalDateTime latestPublication() {
        return publicationSchedule.latestAt(LocalDateTime.ofInstant(clock.instant(), KST));
    }

    private Optional<WeatherCollectionResult> execute(final Source source, final LocalDateTime publishedAt) {
        // 외부 트랜잭션에 참여하면 HTTP 대기 중에도 DB 잠금을 유지하고 단위별 커밋을 잃는다.
        validateNoTransaction(); //  사전 검증: 외부 트랜잭션 안이면 거부하고(기존과 같음), 발표시각도 검증합니다.
        WeatherPublicationSchedule.validatePublication(publishedAt);
        if (!running.compareAndSet(false, true)) {
            LOG.info("weather-collection-execution status=SKIPPED_RUNNING source={} publishedAt={} checkedAt={}",
                    source, publishedAt, clock.instant());
            if (source == Source.SCHEDULED) {   // 자동: 조용히 건너뜀
                return Optional.empty();
            }
            throw new IllegalStateException("이미 날씨 수집이 실행 중입니다.");   // 수동·최초 적재: 예외
        }
        long start = System.nanoTime();
        try {
            Instant startedAt = clock.instant();
            execution = new WeatherCollectionExecution(source, Status.RUNNING, publishedAt, startedAt, null, 0);
            logExecution(execution);
            try {
                // 존재 검사도 같은 실행 구간 안에 두어 최초 적재끼리의 중첩을 막는다.
                //지금 이후의 날씨를 보여 줄 데이터가 있나?
                if (source == Source.INITIAL_LOAD
                        && repository.hasValidHourlyForecastAtOrAfter(LocalDateTime.ofInstant(startedAt, KST))) {
                    finishExecution(Status.SKIPPED_VALID_FORECAST, start);
                    return Optional.empty();
                }
                repository.startCollection(publishedAt, collectedAt());
                WeatherCollectionResult result = collectForecasts(publishedAt);
                finishExecution(Status.SUCCEEDED, start);
                return Optional.of(result);
            } catch (RuntimeException | Error exception) {
                finishExecution(Status.FAILED, start);
                throw exception;
            }
        } finally {
            running.set(false);
        }
    }

    private void finishExecution(final Status status, final long start) {
        execution = new WeatherCollectionExecution(execution.source(), status, execution.publishedAt(),
                execution.startedAt(), clock.instant(), System.nanoTime() - start);
        logExecution(execution);
    }

    private void logExecution(final WeatherCollectionExecution state) {
        LOG.info("weather-collection-execution source={} status={} publishedAt={} startedAt={} finishedAt={} elapsedNanos={}",
                state.source(), state.status(), state.publishedAt(), state.startedAt(), state.finishedAt(), state.elapsedNanos());
    }

    private WeatherCollectionResult collectForecasts(final LocalDateTime publishedAt) {
        Progress progress = new Progress();
        WeatherCollectionPlan plan = WeatherCollectionPlan.forPublication(publishedAt);
        LOG.info("weather-collection-start publishedAt={} plannedRequests={} unavailableDaily={}",
                publishedAt, plan.requestCount(), plan.unavailableDailyForecasts());
        try {
            // 1. 시간별 예보를 수집 및 저장을 48번 하고 날짜별 격자집합을 반환
            // 반환값 : "날짜 → 그 날짜에 저장된 시간별 행들의 격자 좌표 집합"
            Map<LocalDate, Set<GridPoint>> dailyPoints = collectHourly(plan, progress);
            //2. 일별 수집
            collectDaily(plan, dailyPoints, progress);
            long completionStart = System.nanoTime();
            try {
                repository.completeCollection(publishedAt, collectedAt());
            } finally {
                progress.dbNanos += System.nanoTime() - completionStart;
            }
            //3. 결과 정리 -  progress에 쌓인 값을 불변 결과 객체로 바꿈
            WeatherCollectionResult result = progress.result(publishedAt);
            logResult("success", progress.attempts, result);
            return result;
        } catch (RuntimeException exception) {
            // 경계에서 진행량을 남기고 원래 오류를 전파한다. URL·본문·외부 예외 메시지는 기록하지 않는다.
            logResult("failed", progress.attempts, progress.result(publishedAt));
            throw exception;
        }
    }

    private void validateNoTransaction() {
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("날씨 수집은 외부 DB 트랜잭션 없이 실행해야 합니다.");
        }
    }

    //시간별 수집 전체(48개 예보시각 × 8요소)를 실행하고, 각 시각을 DB에 저장 및 커밋
    //요청별 측정값, 결합·DB 시간, 저장 행 수를 progress에 계속 누적
    private Map<LocalDate, Set<GridPoint>> collectHourly(final WeatherCollectionPlan plan, final Progress progress) {

        // 1. (발표시각,예보 시각) 별로 묶기  -> (02시, 10/23 03시) → [TMP, SKY, PTY, POP, PCP, SNO, REH, WSD]
        Map<ForecastTimes, List<KmaForecastRequest>> groups = plan.hourlyRequests().stream()
                .collect(Collectors.groupingBy(KmaForecastRequest::times, LinkedHashMap::new, Collectors.toList()));


        //2. 날짜별 격자 집합 준비
        Map<LocalDate, Set<GridPoint>> dailyPoints = new LinkedHashMap<>();
        for (var entry : groups.entrySet()) { // 예보 시각 하나씩 처리
            // 요청 8개 실행 - TMP부터 WSD까지 순서대로 한 개씩 HTTP 요청·파싱
            List<GridForecast> responses = fetch(entry.getValue(), progress);// [ 전국 03시 TMP, 전국 03시 SKY, ..., 전국 03시 WSD ]


            long mergeStart = System.nanoTime();
            //격자별 행으로 결합 - [(60,127): tmp=17, sky=1, ..., wsd=2.1]
            List<HourlyForecast> rows = hourlyAssembler.assemble(entry.getKey(), responses, collectedAt());

            // 날짜별 격자 집합에 누적
            Set<GridPoint> points = dailyPoints.computeIfAbsent(entry.getKey().forecastAt().toLocalDate(),
                    ignored -> new HashSet<>());


            rows.forEach(row -> points.add(row.point()));
            // 결합 시간 누적
            progress.mergeNanos += System.nanoTime() - mergeStart;
            store(() -> repository.upsertHourly(rows), progress);
            progress.hourlyRows += rows.size();
            LOG.info("weather-hourly-stored forecastAt={} committedInputRows={}", entry.getKey().forecastAt(), rows.size());
        }
        return dailyPoints;
    }

    //결과는 DB와 progress에 남는다.
    private void collectDaily(final WeatherCollectionPlan plan, final Map<LocalDate, Set<GridPoint>> dailyPoints,
                              final Progress progress) {
        for (var entry : dailyPoints.entrySet()) {
            //dailyPoints의 날짜(10/23, 10/24)마다 plan.dailyRequests()에서 그 날짜의 TMN·TMX 요청을 골라서
            //요청 및 파싱한 뒤, 그 날짜의 격자 집합에 TMN·TMX 값을 붙여 DailyForecast를 만들고 날짜마다 저장 및 커밋.
            List<KmaForecastRequest> requests = plan.dailyRequests().stream()
                    .filter(request -> request.times().forecastAt().toLocalDate().equals(entry.getKey())).toList();
            if (requests.isEmpty()) {
                continue;
            }
            List<GridForecast> responses = fetch(requests, progress);
            long mergeStart = System.nanoTime();

            List<DailyForecast> rows = dailyAssembler.assemble(entry.getKey(), entry.getValue(), requests, responses,
                    collectedAt());

            progress.mergeNanos += System.nanoTime() - mergeStart;
            store(() -> repository.upsertDaily(rows), progress);
            progress.dailyRows += rows.size();
            LOG.info("weather-daily-stored forecastDate={} committedInputRows={}", entry.getKey(), rows.size());
        }
    }

    //요청 목록을 순서대로 하나씩 기상청에 보내고, 파싱된 응답을 돌려줌
    private List<GridForecast> fetch(final List<KmaForecastRequest> requests, final Progress progress) {
        List<GridForecast> responses = new ArrayList<>();
        for (KmaForecastRequest request : requests) {
            progress.attempts++;
            LOG.info("weather-request-start tmfc={} tmef={} element={}", request.tmfc(),
                    request.tmef(), request.element());
            ForecastFetchResult fetched = client.fetchMeasured(request);
            GridForecast forecast = fetched.forecast();
            progress.requests.add(new RequestMeasurement(request, fetched.responseBytes(), forecast.validCount(),
                    forecast.missingCount(), fetched.httpNanos(), fetched.parseNanos()));
            LOG.info("weather-request-complete tmfc={} tmef={} element={} bytes={} valid={} missing={} httpNanos={} parseNanos={}",
                    request.tmfc(), request.tmef(), request.element(), fetched.responseBytes(),
                    forecast.validCount(), forecast.missingCount(), fetched.httpNanos(), fetched.parseNanos());
            responses.add(forecast);
        }
        return responses;
    }

    private void store(final Runnable write, final Progress progress) {
        long start = System.nanoTime();
        try {
            transaction.executeWithoutResult(status -> write.run());
        } finally {
            // 커넥션 획득·배치·커밋(실패 시 롤백)·정리까지 포함한다. 검증 SELECT는 수행하지 않는다.
            progress.dbNanos += System.nanoTime() - start;
        }
    }

    private LocalDateTime collectedAt() {
        return LocalDateTime.ofInstant(clock.instant(), KST).truncatedTo(ChronoUnit.MICROS);
    }

    private void logResult(final String status, final int attempts, final WeatherCollectionResult result) {
        LOG.info("weather-collection-complete status={} publishedAt={} attemptedRequests={} completedRequests={} "
                        + "responseBytes={} validValues={} missingValues={} hourlyCommittedInputRows={} dailyCommittedInputRows={} "
                        + "httpNanos={} parseNanos={} mergeNanos={} dbNanos={} totalNanos={}",
                status, result.publishedAt(), attempts, result.requestCount(), result.responseBytes(), result.validValues(),
                result.missingValues(), result.hourlyRows(), result.dailyRows(), result.httpNanos(), result.parseNanos(),
                result.mergeNanos(), result.dbNanos(), result.totalNanos());
    }

    private static class Progress {

        private final long start = System.nanoTime();
        private final List<RequestMeasurement> requests = new ArrayList<>();
        private int attempts;
        private long hourlyRows;
        private long dailyRows;
        private long mergeNanos;
        private long dbNanos;

        private WeatherCollectionResult result(final LocalDateTime publishedAt) {
            return new WeatherCollectionResult(publishedAt, requests, hourlyRows, dailyRows, mergeNanos, dbNanos,
                    System.nanoTime() - start);
        }
    }
}
