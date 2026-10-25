package com.jachwisunbae.weather.notification.service;

import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.client.ResourceNotFoundException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.member.service.MemberService;
import com.jachwisunbae.weather.notification.domain.WeatherDevice;
import com.jachwisunbae.weather.notification.domain.WeatherDevice.Permission;
import com.jachwisunbae.weather.notification.domain.WeatherDevice.Platform;
import com.jachwisunbae.weather.notification.repository.WeatherNotificationSettingsRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
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

    public List<WeatherDevice> devices(final long memberId) {
        members.findProfileById(memberId);
        return repository.devices(memberId);
    }

    @Transactional
    public WeatherDevice register(final long memberId, final UUID installationId, final String installationSecret,
                                   final String token, final Platform platform, final Permission permission) {
        members.findProfileById(memberId);
        if (installationId == null || installationSecret == null || !installationSecret.matches("[A-Za-z0-9_-]{43,128}")
                || platform == null || permission == null
                || permission == Permission.GRANTED && (token == null || !token.matches("[\\x21-\\x7E]{20,4096}"))) {
            throw new InvalidInputException(ErrorCode.WEATHER_DEVICE_INVALID, "알림 기기 입력 형식 오류");
        }
        String secretHash = hash(installationSecret);
        WeatherDevice previous = repository.device(installationId).orElse(null);
        if (previous != null && !MessageDigest.isEqual(previous.secretHash().getBytes(StandardCharsets.US_ASCII),
                secretHash.getBytes(StandardCharsets.US_ASCII))) {
            throw conflict();
        }
        String storedToken = permission == Permission.GRANTED ? token : null;
        boolean active = permission == Permission.GRANTED;
        if (previous != null && previous.memberId() == memberId && previous.active() == active
                && Objects.equals(previous.token(), storedToken) && previous.platform() == platform && previous.permission() == permission) {
            return previous;
        }
        if (active && (previous == null || previous.memberId() != memberId || !previous.active())
                && repository.activeDeviceCountForRegistration(memberId, clock.instant()) >= 10) {
            throw new InvalidInputException(ErrorCode.WEATHER_DEVICE_LIMIT_EXCEEDED, "활성 알림 기기 수 초과");
        }
        WeatherDevice device = new WeatherDevice(installationId, memberId, secretHash, storedToken, platform, permission,
                active, previous == null ? 1 : previous.version() + 1, clock.instant().truncatedTo(ChronoUnit.MICROS));
        try {
            if (previous == null) {
                repository.register(device, storedToken == null ? null : hash(storedToken));
            } else if (repository.replace(device, storedToken == null ? null : hash(storedToken), secretHash, previous.version()) != 1) {
                throw conflict();
            }
        } catch (DuplicateKeyException exception) {
            // DB 오류에는 토큰이 포함될 수 있으므로 원인·메시지를 공개 로그로 전달하지 않는다.
            throw conflict();
        }
        return device;
    }

    @Transactional
    public void revoke(final long memberId, final UUID installationId) {
        members.findProfileById(memberId);
        WeatherDevice device = repository.device(installationId).filter(value -> value.memberId() == memberId)
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.WEATHER_DEVICE_NOT_FOUND, "소유한 알림 기기가 없습니다."));
        repository.revoke(memberId, device.installationId(), clock.instant());
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
