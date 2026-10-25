package com.jachwisunbae.weather.notification.service;

import com.jachwisunbae.weather.domain.MemberWeatherLocation;
import com.jachwisunbae.weather.notification.domain.NotificationSlot;
import com.jachwisunbae.weather.notification.domain.WeatherDevice;
import com.jachwisunbae.weather.notification.domain.WeatherNotification;
import com.jachwisunbae.weather.notification.domain.WeatherNotification.SendResult;
import com.jachwisunbae.weather.notification.provider.WeatherPushSender;
import com.jachwisunbae.weather.notification.provider.WeatherPushSender.Push;
import com.jachwisunbae.weather.notification.repository.WeatherNotificationRepository;
import com.jachwisunbae.weather.notification.repository.WeatherNotificationSettingsRepository;
import com.jachwisunbae.weather.service.MemberWeatherLocationService;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class WeatherNotificationDispatchService {
    private static final Logger LOG = LoggerFactory.getLogger(WeatherNotificationDispatchService.class);
    private final WeatherNotificationSettingsRepository settings;
    private final WeatherNotificationRepository notifications;
    private final MemberWeatherLocationService locations;
    private final LifeWeatherAnalysisService analysis;
    private final WeatherPushSender sender;
    private final Clock clock;
    private final boolean enabled;

    public WeatherNotificationDispatchService(final WeatherNotificationSettingsRepository settings,
            final WeatherNotificationRepository notifications, final MemberWeatherLocationService locations,
            final LifeWeatherAnalysisService analysis, final WeatherPushSender sender, final Clock clock,
            @Value("${weather.notification.enabled:false}") final boolean enabled) {
        this.settings = settings;
        this.notifications = notifications;
        this.locations = locations;
        this.analysis = analysis;
        this.sender = sender;
        this.clock = clock;
        this.enabled = enabled;
    }

    public void dispatch(final NotificationSlot slot) {
        if (!enabled) {
            return;
        }
        LocalDate date = LocalDate.ofInstant(clock.instant(), NotificationSlot.KST);
        for (long memberId : settings.enabledMemberIds()) {
            try {
                send(memberId, date, slot);
            } catch (RuntimeException exception) {
                LOG.warn("weather-notification-failed exceptionType={}", exception.getClass().getSimpleName());
            }
        }
    }

    private void send(final long memberId, final LocalDate date, final NotificationSlot slot) {
        WeatherDevice device = settings.findByMember(memberId).filter(WeatherDevice::active).orElse(null);
        MemberWeatherLocation location = locations.find(memberId);
        if (device == null || !valid(location, clock.instant())) {
            return;
        }
        var report = analysis.analyze(location.grid(), date, slot);
        if (!report.sendable()) {
            return;
        }
        var notification = new WeatherNotification(UUID.randomUUID(), memberId, date, slot, slot.targetDate(date),
                location.grid(), report.title(), report.body(), report.assessments(), null, clock.instant());
        // 유니크 키 삽입에 성공한 호출만 한 번 전송한다. 저장 후 중단된 작업을 복구하지 않는다.
        if (!notifications.saveIfAbsent(notification)) {
            return;
        }
        boolean success = false;
        try {
            WeatherDevice current = settings.findByMember(memberId).orElse(null);
            MemberWeatherLocation currentLocation = locations.find(memberId);
            if (settings.enabled(memberId) && current != null && current.active()
                    && current.installationId().equals(device.installationId()) && Objects.equals(current.token(), device.token())
                    && valid(currentLocation, clock.instant()) && currentLocation.grid().equals(location.grid())) {
                success = sender.send(new Push(notification.notificationId(), current.token(), report.title(), report.body(),
                        notification.targetDate().toString(), slot.name()));
            }
        } catch (RuntimeException exception) {
            LOG.warn("weather-push-failed notificationId={} exceptionType={}", notification.notificationId(), exception.getClass().getSimpleName());
        }
        notifications.recordResult(notification.notificationId(), success ? SendResult.SUCCESS : SendResult.FAILED);
        LOG.info("weather-notification notificationId={} success={}", notification.notificationId(), success);
    }

    private boolean valid(final MemberWeatherLocation location, final Instant now) {
        return location.isAvailable() && location.observedAt() != null
                && !location.observedAt().isBefore(now.minus(Duration.ofHours(24))) && !location.observedAt().isAfter(now.plusSeconds(60));
    }
}
