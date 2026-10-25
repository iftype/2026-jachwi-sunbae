package com.jachwisunbae.weather.notification.service;

import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.client.ResourceNotFoundException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.member.service.MemberService;
import com.jachwisunbae.weather.notification.domain.PreparedWeatherNotification;
import com.jachwisunbae.weather.notification.domain.WeatherDelivery;
import com.jachwisunbae.weather.notification.domain.WeatherDelivery.Status;
import com.jachwisunbae.weather.notification.repository.WeatherNotificationRepository;
import com.jachwisunbae.weather.notification.repository.WeatherNotificationSettingsRepository;
import com.jachwisunbae.weather.notification.service.dto.WeatherNotificationSnapshot;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class WeatherNotificationHistoryService {
    private final MemberService members;
    private final WeatherNotificationRepository repository;
    private final WeatherNotificationSettingsRepository settings;
    private final WeatherNotificationSnapshotCodec codec;
    private final Clock clock;

    public WeatherNotificationHistoryService(final MemberService members, final WeatherNotificationRepository repository,
            final WeatherNotificationSettingsRepository settings, final WeatherNotificationSnapshotCodec codec, final Clock clock) {
        this.members = members;
        this.repository = repository;
        this.settings = settings;
        this.codec = codec;
        this.clock = clock;
    }

    public List<Detail> recent(final long memberId, final int limit) {
        members.findProfileById(memberId);
        if (limit < 1 || limit > 100) {
            throw new InvalidInputException(ErrorCode.INVALID_REQUEST, "알림 목록 개수는 1~100입니다.");
        }
        return repository.recent(memberId, limit).stream().map(this::detail).toList();
    }

    public Detail find(final long memberId, final UUID id) {
        members.findProfileById(memberId);
        return detail(repository.findOwned(memberId, id)
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.WEATHER_NOTIFICATION_NOT_FOUND, "소유한 날씨 알림이 없습니다.")));
    }

    @Transactional
    public void receipt(final long memberId, final UUID notificationId, final UUID installationId, final boolean opened) {
        Detail detail = find(memberId, notificationId);
        boolean ownedDevice = settings.device(installationId).filter(device -> device.memberId() == memberId).isPresent();
        boolean sent = detail.deliveries().stream().anyMatch(delivery -> delivery.installationId().equals(installationId)
                && List.of(Status.SENDING, Status.ACCEPTED, Status.UNKNOWN).contains(delivery.status()));
        if (!ownedDevice || !sent) {
            throw new InvalidInputException(ErrorCode.WEATHER_NOTIFICATION_RECEIPT_INVALID, "수신 기록 대상이 아닙니다.");
        }
        repository.receipt(memberId, notificationId, installationId, opened, clock.instant());
    }

    private Detail detail(final PreparedWeatherNotification notification) {
        return new Detail(notification, codec.read(notification.snapshot()), repository.deliveries(notification.notificationId()));
    }

    public record Detail(PreparedWeatherNotification notification, WeatherNotificationSnapshot snapshot,
                          List<WeatherDelivery> deliveries) { }
}
