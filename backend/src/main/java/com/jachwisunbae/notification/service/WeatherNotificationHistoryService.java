package com.jachwisunbae.notification.service;

import com.jachwisunbae.common.exception.client.ResourceNotFoundException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.member.service.MemberService;
import com.jachwisunbae.notification.domain.WeatherNotification;
import com.jachwisunbae.notification.repository.WeatherNotificationRepository;
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

    public WeatherNotification find(final long memberId, final UUID id) {
        members.findProfileById(memberId);
        return repository.findOwned(memberId, id)
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.WEATHER_NOTIFICATION_NOT_FOUND, "소유한 날씨 알림이 없습니다."));
    }
}
