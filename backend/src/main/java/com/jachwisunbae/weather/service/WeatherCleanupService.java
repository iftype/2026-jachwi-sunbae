package com.jachwisunbae.weather.service;

import com.jachwisunbae.weather.repository.JdbcWeatherForecastRepository;
import com.jachwisunbae.weather.service.dto.result.WeatherCleanupResult;
import com.jachwisunbae.weather.service.dto.result.WeatherCleanupResult.TableCleanup;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class WeatherCleanupService {

    private static final Logger LOG = LoggerFactory.getLogger(WeatherCleanupService.class);
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final JdbcWeatherForecastRepository repository;
    private final TransactionTemplate transaction;
    private final Clock clock;
    private final boolean enabled;
    private final AtomicBoolean running = new AtomicBoolean();

    public WeatherCleanupService(final JdbcWeatherForecastRepository repository,
                                 final PlatformTransactionManager transactionManager, final Clock clock,
                                 @Value("${weather.cleanup.enabled:false}") final boolean enabled) {
        this.repository = repository;
        this.transaction = new TransactionTemplate(transactionManager);
        this.clock = clock;
        this.enabled = enabled;
    }

    public WeatherCleanupResult cleanup() {
        if (!enabled) {
            throw new IllegalStateException("날씨 정리는 weather.cleanup.enabled=true 설정이 필요합니다.");
        }
        // 호출자가 연 트랜잭션에 참여하면 실제 커밋 전에 성공과 소요시간을 기록하게 된다.
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("날씨 정리는 외부 DB 트랜잭션 없이 실행해야 합니다.");
        }
        if (!running.compareAndSet(false, true)) {
            LOG.info("weather-cleanup status=SKIPPED_RUNNING checkedAt={}", clock.instant());
            throw new IllegalStateException("이미 날씨 정리가 실행 중입니다.");
        }
        long start = System.nanoTime();
        try {
            Instant startedAt = clock.instant();
            // 실행 중 자정을 지나더라도 두 테이블에 같은 KST 날짜를 적용한다.
            LocalDate retainedFrom = startedAt.atZone(KST).toLocalDate();
            LOG.info("weather-cleanup status=RUNNING retainedFrom={} hourlyCutoff={} startedAt={}",
                    retainedFrom, retainedFrom.atStartOfDay(), startedAt);
            try {
                CleanupTables tables = transaction.execute(status -> deleteExpired(retainedFrom));
                WeatherCleanupResult result = new WeatherCleanupResult(retainedFrom, startedAt, clock.instant(),
                        tables.hourly(), tables.daily(), System.nanoTime() - start);
                LOG.info("weather-cleanup status=SUCCEEDED retainedFrom={} startedAt={} finishedAt={} "
                                + "hourlyBefore={} hourlyDeleted={} hourlyAfter={} dailyBefore={} dailyDeleted={} "
                                + "dailyAfter={} elapsedNanos={}",
                        retainedFrom, startedAt, result.finishedAt(), result.hourly().beforeRows(),
                        result.hourly().deletedRows(), result.hourly().afterRows(), result.daily().beforeRows(),
                        result.daily().deletedRows(), result.daily().afterRows(), result.elapsedNanos());
                return result;
            } catch (RuntimeException | Error exception) {
                LOG.warn("weather-cleanup status=FAILED retainedFrom={} startedAt={} finishedAt={} elapsedNanos={} exceptionType={}",
                        retainedFrom, startedAt, clock.instant(), System.nanoTime() - start,
                        exception.getClass().getSimpleName());
                throw exception;
            }
        } finally {
            running.set(false);
        }
    }

    private CleanupTables deleteExpired(final LocalDate retainedFrom) {
        long hourlyBefore = repository.countHourly();
        long dailyBefore = repository.countDaily();
        int hourlyDeleted = repository.deleteHourlyBefore(retainedFrom.atStartOfDay());
        int dailyDeleted = repository.deleteDailyBefore(retainedFrom);
        return new CleanupTables(
                new TableCleanup(hourlyBefore, hourlyDeleted, repository.countHourly()),
                new TableCleanup(dailyBefore, dailyDeleted, repository.countDaily())
        );
    }

    private record CleanupTables(TableCleanup hourly, TableCleanup daily) {
    }
}
