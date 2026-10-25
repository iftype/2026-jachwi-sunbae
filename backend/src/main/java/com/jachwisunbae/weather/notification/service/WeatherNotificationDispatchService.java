package com.jachwisunbae.weather.notification.service;

import com.jachwisunbae.weather.notification.domain.NotificationSlot;
import com.jachwisunbae.weather.notification.domain.PreparedWeatherNotification;
import com.jachwisunbae.weather.notification.domain.WeatherDelivery;
import com.jachwisunbae.weather.notification.domain.WeatherDelivery.Status;
import com.jachwisunbae.weather.notification.provider.WeatherPushSender;
import com.jachwisunbae.weather.notification.provider.WeatherPushSender.Outcome;
import com.jachwisunbae.weather.notification.provider.WeatherPushSender.Push;
import com.jachwisunbae.weather.notification.provider.WeatherPushSender.Result;
import com.jachwisunbae.weather.notification.repository.WeatherNotificationRepository;
import com.jachwisunbae.weather.notification.repository.WeatherNotificationSettingsRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class WeatherNotificationDispatchService {
    private static final Logger LOG = LoggerFactory.getLogger(WeatherNotificationDispatchService.class);
    private final WeatherNotificationSettingsRepository settings;
    private final WeatherNotificationRepository repository;
    private final WeatherNotificationPreparationService preparation;
    private final WeatherNotificationSnapshotCodec codec;
    private final WeatherPushSender sender;
    private final Clock clock;
    private final boolean enabled;
    private final AtomicBoolean running = new AtomicBoolean();

    public WeatherNotificationDispatchService(final WeatherNotificationSettingsRepository settings,
            final WeatherNotificationRepository repository, final WeatherNotificationPreparationService preparation,
            final WeatherNotificationSnapshotCodec codec, final WeatherPushSender sender, final Clock clock,
            @Value("${weather.notification.enabled:false}") final boolean enabled) {
        this.settings = settings;
        this.repository = repository;
        this.preparation = preparation;
        this.codec = codec;
        this.sender = sender;
        this.clock = clock;
        this.enabled = enabled;
    }

    public RunResult dispatchCurrentSlot() {
        if (!enabled) {
            return new RunResult("DISABLED", 0, 0, 0, 0);
        }
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("날씨 알림 발송은 외부 트랜잭션 없이 실행해야 합니다.");
        }
        var selected = NotificationSlot.activeAt(clock.instant());
        if (selected.isEmpty()) {
            return new RunResult("OUTSIDE_WINDOW", 0, 0, 0, 0);
        }
        if (!running.compareAndSet(false, true)) {
            return new RunResult("ALREADY_RUNNING", 0, 0, 0, 0);
        }
        long start = System.nanoTime();
        int members = 0;
        int attempts = 0;
        int accepted = 0;
        int skipped = 0;
        try {
            repository.recover(clock.instant());
            NotificationSlot slot = selected.orElseThrow();
            LocalDate date = clock.instant().atZone(NotificationSlot.KST).toLocalDate();
            long cursor = 0;
            while (clock.instant().isBefore(slot.expiresAt(date))) {
                List<Long> page = settings.enabledMemberIdsAfter(cursor, 100);
                if (page.isEmpty()) {
                    break;
                }
                for (long memberId : page) {
                    cursor = memberId;
                    members++;
                    try {
                        var notification = preparation.prepare(memberId, date, slot);
                        if (notification.isEmpty()) {
                            skipped++;
                            continue;
                        }
                        for (WeatherDelivery delivery : repository.deliveries(notification.get().notificationId())) {
                            Status outcome = deliver(notification.get(), delivery);
                            if (outcome != null) {
                                attempts++;
                                if (outcome == Status.ACCEPTED) {
                                    accepted++;
                                }
                            }
                        }
                    } catch (RuntimeException exception) {
                        skipped++;
                        LOG.error("weather-notification-member-failed exceptionType={}", exception.getClass().getSimpleName());
                    }
                }
            }
            return new RunResult("COMPLETED", members, attempts, accepted, skipped);
        } finally {
            running.set(false);
            LOG.info("weather-notification-run members={} attempts={} accepted={} skipped={} elapsedNanos={}",
                    members, attempts, accepted, skipped, System.nanoTime() - start);
        }
    }

    private Status deliver(final PreparedWeatherNotification notification, final WeatherDelivery delivery) {
        Instant now = clock.instant();
        if (delivery.status() != Status.PENDING && delivery.status() != Status.RETRY || delivery.nextAttemptAt().isAfter(now)) {
            return null;
        }
        var device = settings.device(delivery.installationId());
        // 발송권을 얻기 전 토큰을 읽어 등록 변경 전후의 정보를 섞지 않는다.
        if (device.isEmpty() || device.get().version() != delivery.registrationVersion()
                || !repository.claim(delivery, now, now.minus(WeatherNotificationPreparationService.LOCATION_MAX_AGE))) {
            repository.cancelUnclaimed(delivery, now);
            return null;
        }
        var snapshot = codec.read(notification.snapshot());
        Result result;
        try {
            result = sender.send(new Push(notification.notificationId(), device.get().token(), snapshot.report().title(),
                    snapshot.report().body(), notification.targetDate().toString(), notification.slot().name(), notification.expiresAt()));
        } catch (RuntimeException exception) {
            result = Result.failed(Outcome.UNKNOWN, "PROVIDER_RUNTIME_ERROR");
        }
        Instant finished = clock.instant();
        Instant next = finished.plus(result.retryAfter());
        Status status = switch (result.outcome()) {
            case ACCEPTED -> Status.ACCEPTED;
            case INVALID_TOKEN, REJECTED -> Status.FAILED;
            case UNKNOWN -> Status.UNKNOWN;
            case DISABLED -> Status.CANCELLED;
            case RETRYABLE -> delivery.attempts() + 1 < 3 && next.isBefore(notification.expiresAt()) ? Status.RETRY : Status.FAILED;
        };
        if (result.outcome() == Outcome.INVALID_TOKEN) {
            settings.invalidateToken(delivery.installationId(), delivery.registrationVersion(), finished);
        }
        repository.finish(delivery, status, finished, next, result.providerMessageId(), result.errorCode());
        LOG.info("weather-notification-delivery notificationId={} status={} attempt={} code={}",
                notification.notificationId(), status, delivery.attempts() + 1, result.errorCode());
        return status;
    }

    public record RunResult(String status, int members, int attempts, int accepted, int skipped) { }
}
