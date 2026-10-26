package com.jachwisunbae.notification.service;

import com.jachwisunbae.weather.domain.MemberWeatherLocation;
import com.jachwisunbae.notification.domain.NotificationSlot;
import com.jachwisunbae.notification.domain.WeatherDevice;
import com.jachwisunbae.notification.domain.WeatherNotification;
import com.jachwisunbae.notification.domain.WeatherNotification.SendResult;
import com.jachwisunbae.notification.provider.WeatherPushSender;
import com.jachwisunbae.notification.provider.WeatherPushSender.Push;
import com.jachwisunbae.notification.repository.WeatherNotificationRepository;
import com.jachwisunbae.notification.repository.WeatherNotificationSettingsRepository;
import com.jachwisunbae.weather.service.MemberWeatherLocationService;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

// 알림 시간대(아침·저녁)마다 알림을 켠 회원에게 생활 날씨 푸시를 보낸다.
// 아침(07시)은 오늘, 저녁(22시)은 내일 날씨를 알린다.
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
        // weather.notification.enabled=false면 아무것도 보내지 않는다. (Firebase 준비 전 OFF)
        if (!enabled) {
            return;
        }
        LocalDate date = LocalDate.ofInstant(clock.instant(), NotificationSlot.KST);
        // 한 회원의 실패가 다른 회원 발송을 막지 않도록 회원 단위로 예외를 격리한다.
        for (long memberId : settings.enabledMemberIds()) {
            try {
                send(memberId, date, slot);
            } catch (RuntimeException exception) {
                LOG.warn("weather-notification-failed exceptionType={}", exception.getClass().getSimpleName());
            }
        }
    }

    // 한 회원에게 보낼 알림을 만들고, 저장에 성공한 경우에만 한 번 전송한 뒤 결과를 기록한다.
    private void send(final long memberId, final LocalDate date, final NotificationSlot slot) {
        WeatherDevice device = settings.findByMember(memberId).filter(WeatherDevice::active).orElse(null);
        MemberWeatherLocation location = locations.find(memberId);
        // 활성 기기와 저장된 위치(격자)가 모두 있어야 보낼 수 있다.
        if (device == null || !location.isAvailable()) {
            return;
        }
        // 예보를 분석해 알림 문구를 만든다. 예보가 준비되지 않았거나 필수 값(기온·강수형태)이 없으면 보내지 않는다.
        var report = analysis.analyze(location.grid(), date, slot);
        if (!report.sendable()) {
            return;
        }
        var notification = new WeatherNotification(UUID.randomUUID(), memberId, date, slot, slot.targetDate(date),
                location.grid(), report.title(), report.body(), report.notices(), null, clock.instant());
        // (회원, 발송일, 시간대) 유니크 키 삽입에 성공한 호출만 한 번 전송한다. 중복 실행돼도 두 번 보내지 않는다.
        // 저장 후 중단된 작업을 복구하지 않는다.
        if (!notifications.saveIfAbsent(notification)) {
            return;
        }
        boolean success = false;
        try {
            // 분석하는 사이 알림을 끄거나, 기기·토큰이 바뀌거나, 위치를 삭제했다면 보내지 않는다.
            WeatherDevice current = settings.findByMember(memberId).orElse(null);
            MemberWeatherLocation currentLocation = locations.find(memberId);
            if (settings.enabled(memberId) && current != null && current.active()
                    && current.installationId().equals(device.installationId()) && Objects.equals(current.token(), device.token())
                    && currentLocation.isAvailable()) {
                success = sender.send(new Push(notification.notificationId(), current.token(), report.title(), report.body(),
                        notification.targetDate().toString(), slot.name()));
            }
        } catch (RuntimeException exception) {
            LOG.warn("weather-push-failed notificationId={} exceptionType={}", notification.notificationId(), exception.getClass().getSimpleName());
        }
        // 전송하지 않은 경우(조건 불충족·예외)도 FAILED로 남긴다.
        notifications.recordResult(notification.notificationId(), success ? SendResult.SUCCESS : SendResult.FAILED);
        LOG.info("weather-notification notificationId={} success={}", notification.notificationId(), success);
    }
}
