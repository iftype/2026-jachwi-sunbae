package com.jachwisunbae.weather.notification.service;

import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.client.ResourceNotFoundException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.member.service.MemberService;
import com.jachwisunbae.weather.notification.domain.WeatherNotification;
import com.jachwisunbae.weather.notification.repository.WeatherNotificationRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class WeatherNotificationHistoryService {
    private final MemberService members;
    private final WeatherNotificationRepository repository;

    public WeatherNotificationHistoryService(final MemberService members, final WeatherNotificationRepository repository) {
        this.members = members;
        this.repository = repository;
    }

    public List<WeatherNotification> recent(final long memberId, final int limit) {
        members.findProfileById(memberId);
        if (limit < 1 || limit > 100) {
            throw new InvalidInputException(ErrorCode.INVALID_REQUEST, "알림 목록 개수는 1~100입니다.");
        }
        return repository.recent(memberId, limit);
    }

    public WeatherNotification find(final long memberId, final UUID id) {
        members.findProfileById(memberId);
        return repository.findOwned(memberId, id)
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.WEATHER_NOTIFICATION_NOT_FOUND, "소유한 날씨 알림이 없습니다."));
    }
}
