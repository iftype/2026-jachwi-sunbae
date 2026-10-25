package com.jachwisunbae.weather.notification.service;

import com.jachwisunbae.weather.domain.MemberWeatherLocation;
import com.jachwisunbae.weather.notification.domain.NotificationSlot;
import com.jachwisunbae.weather.notification.domain.PreparedWeatherNotification;
import com.jachwisunbae.weather.notification.domain.WeatherDevice;
import com.jachwisunbae.weather.notification.repository.WeatherNotificationRepository;
import com.jachwisunbae.weather.notification.repository.WeatherNotificationSettingsRepository;
import com.jachwisunbae.weather.service.MemberWeatherLocationService;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WeatherNotificationPreparationService {
    public static final Duration LOCATION_MAX_AGE = Duration.ofHours(24);
    private final WeatherNotificationRepository notifications;
    private final WeatherNotificationSettingsRepository settings;
    private final MemberWeatherLocationService locations;
    private final LifeWeatherAnalysisService analysis;
    private final WeatherNotificationSnapshotCodec codec;
    private final Clock clock;

    public WeatherNotificationPreparationService(final WeatherNotificationRepository notifications,
            final WeatherNotificationSettingsRepository settings, final MemberWeatherLocationService locations,
            final LifeWeatherAnalysisService analysis, final WeatherNotificationSnapshotCodec codec, final Clock clock) {
        this.notifications = notifications;
        this.settings = settings;
        this.locations = locations;
        this.analysis = analysis;
        this.codec = codec;
        this.clock = clock;
    }

    @Transactional
    public Optional<PreparedWeatherNotification> prepare(final long memberId, final LocalDate date, final NotificationSlot slot) {
        Instant now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        if (!now.atZone(NotificationSlot.KST).toLocalDate().equals(date)
                || NotificationSlot.activeAt(now).filter(value -> value == slot).isEmpty() || !settings.enabled(memberId)) {
            return Optional.empty();
        }
        var existing = notifications.find(memberId, date, slot);
        if (existing.isPresent()) {
            return existing;
        }
        MemberWeatherLocation location = locations.find(memberId);
        if (!location.isAvailable() || location.observedAt() == null
                || location.observedAt().isBefore(now.minus(LOCATION_MAX_AGE)) || location.observedAt().isAfter(now.plusSeconds(60))) {
            return Optional.empty();
        }
        var devices = settings.devices(memberId).stream().filter(WeatherDevice::active).toList();
        if (devices.isEmpty()) {
            return Optional.empty();
        }
        var snapshot = analysis.analyze(location.grid(), date, slot);
        if (!snapshot.report().sendable()) {
            return Optional.empty();
        }
        var notification = new PreparedWeatherNotification(UUID.randomUUID(), memberId, date, slot, slot.targetDate(date),
                location.grid(), location.observedAt(), now, slot.expiresAt(date), codec.write(snapshot));
        return Optional.of(notifications.saveIfAbsent(notification, devices));
    }
}
