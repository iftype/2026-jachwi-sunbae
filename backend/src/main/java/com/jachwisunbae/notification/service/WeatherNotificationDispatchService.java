package com.jachwisunbae.notification.service;

import com.jachwisunbae.notification.domain.NotificationSlot;
import com.jachwisunbae.notification.domain.WeatherDevice;
import com.jachwisunbae.notification.domain.WeatherNotification;
import com.jachwisunbae.notification.provider.WeatherPushSender;
import com.jachwisunbae.notification.provider.WeatherPushSender.Push;
import com.jachwisunbae.notification.repository.WeatherNotificationRepository;
import com.jachwisunbae.notification.repository.WeatherNotificationSettingsRepository;
import com.jachwisunbae.weather.repository.MemberWeatherLocationRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class WeatherNotificationDispatchService {
    private static final Logger LOG = LoggerFactory.getLogger(WeatherNotificationDispatchService.class);
    private final WeatherNotificationSettingsRepository settings;
    private final WeatherNotificationRepository notifications;
    private final MemberWeatherLocationRepository locations;
    private final LifeWeatherAnalysisService analysis;
    private final WeatherPushSender sender;
    private final Clock clock;

    public WeatherNotificationDispatchService(final WeatherNotificationSettingsRepository settings,
            final WeatherNotificationRepository notifications, final MemberWeatherLocationRepository locations,
            final LifeWeatherAnalysisService analysis, final WeatherPushSender sender, final Clock clock) {
        this.settings = settings;
        this.notifications = notifications;
        this.locations = locations;
        this.analysis = analysis;
        this.sender = sender;
        this.clock = clock;
    }

    public void dispatch(final NotificationSlot slot) {
        LocalDate date = LocalDate.ofInstant(clock.instant(), NotificationSlot.KST);
        for (WeatherDevice device : settings.enabledDevices()) {
            try {
                send(device, date, slot);
            } catch (RuntimeException exception) {
                LOG.warn("weather-notification-failed exceptionType={}", exception.getClass().getSimpleName());
            }
        }
    }

    private void send(final WeatherDevice device, final LocalDate date, final NotificationSlot slot) {
        var location = locations.find(device.memberId()).orElse(null);
        if (location == null) {
            return;
        }
        var report = analysis.analyze(location.grid(), date, slot);
        if (!report.sendable()) {
            return;
        }
        var notification = new WeatherNotification(UUID.randomUUID(), device.memberId(), date, slot, slot.targetDate(date),
                location.grid(), report.title(), report.body(), report.notices(), clock.instant());
        // DB 유니크 키 삽입에 성공한 호출만 발송한다. 저장 후 중단·발송 실패를 자동 재시도하지 않는다.
        if (!notifications.saveIfAbsent(notification)) {
            return;
        }
        boolean success = settings.canSend(device)
                && sender.send(new Push(notification.notificationId(), device.token(), report.title(), report.body()));
        LOG.info("weather-notification notificationId={} success={}", notification.notificationId(), success);
    }
}
