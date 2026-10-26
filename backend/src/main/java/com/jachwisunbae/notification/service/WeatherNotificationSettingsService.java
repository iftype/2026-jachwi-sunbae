package com.jachwisunbae.notification.service;

import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.member.service.MemberService;
import com.jachwisunbae.notification.domain.WeatherDevice;
import com.jachwisunbae.notification.repository.WeatherNotificationSettingsRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class WeatherNotificationSettingsService {
    private final MemberService members;
    private final WeatherNotificationSettingsRepository repository;
    private final Clock clock;

    public WeatherNotificationSettingsService(final MemberService members, final WeatherNotificationSettingsRepository repository,
                                               final Clock clock) {
        this.members = members;
        this.repository = repository;
        this.clock = clock;
    }

    public boolean enabled(final long memberId) {
        members.findProfileById(memberId);
        return repository.enabled(memberId);
    }

    @Transactional
    public void setEnabled(final long memberId, final boolean enabled) {
        members.findProfileById(memberId);
        repository.setEnabled(memberId, enabled, clock.instant());
    }

    public Optional<WeatherDevice> device(final long memberId) {
        members.findProfileById(memberId);
        return repository.findByMember(memberId).filter(device -> device.token() != null);
    }

    @Transactional
    public WeatherDevice register(final long memberId, final UUID installationId, final String installationSecret,
                                   final String token) {
        members.findProfileById(memberId);
        String secretHash = hash(installationSecret);
        WeatherDevice previous = repository.findInstallation(installationId).orElse(null);
        if (previous != null && !MessageDigest.isEqual(previous.secretHash().getBytes(StandardCharsets.US_ASCII),
                secretHash.getBytes(StandardCharsets.US_ASCII))) {
            throw conflict();
        }
        WeatherDevice device = new WeatherDevice(installationId, memberId, secretHash, token, clock.instant());
        try {
            repository.save(device, hash(token));
        } catch (DuplicateKeyException exception) {
            throw conflict();
        }
        return device;
    }

    @Transactional
    public void revoke(final long memberId) {
        members.findProfileById(memberId);
        repository.revoke(memberId, clock.instant());
    }

    private InvalidInputException conflict() {
        return new InvalidInputException(ErrorCode.WEATHER_DEVICE_CONFLICT, "기기 소유 증명·중복·동시 변경 확인 필요");
    }

    private String hash(final String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256을 사용할 수 없습니다.");
        }
    }
}
