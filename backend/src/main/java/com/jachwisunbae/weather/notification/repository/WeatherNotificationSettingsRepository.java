package com.jachwisunbae.weather.notification.repository;

import com.jachwisunbae.weather.notification.domain.WeatherDevice;
import com.jachwisunbae.weather.notification.domain.WeatherDevice.Permission;
import com.jachwisunbae.weather.notification.domain.WeatherDevice.Platform;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class WeatherNotificationSettingsRepository {
    private final JdbcTemplate jdbc;

    public WeatherNotificationSettingsRepository(final JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public boolean enabled(final long memberId) {
        return jdbc.query("SELECT enabled FROM member_weather_notification_settings WHERE member_id = ?",
                (rs, row) -> rs.getBoolean(1), memberId).stream().findFirst().orElse(false);
    }

    public void setEnabled(final long memberId, final boolean enabled, final Instant now) {
        jdbc.update("""
                INSERT INTO member_weather_notification_settings (member_id, enabled, updated_at)
                VALUES (?, ?, ?) AS incoming
                ON DUPLICATE KEY UPDATE enabled = incoming.enabled, updated_at = incoming.updated_at
                """, memberId, enabled, utc(now));
        if (!enabled) {
            jdbc.update("""
                    UPDATE weather_notification_deliveries d JOIN weather_notifications n USING (notification_id)
                    SET d.status = 'CANCELLED', d.error_code = 'CONSENT_REVOKED', d.finished_at = ?
                    WHERE n.member_id = ? AND d.status IN ('PENDING', 'RETRY')
                    """, utc(now), memberId);
        }
    }

    public List<Long> enabledMemberIdsAfter(final long lastMemberId, final int limit) {
        return jdbc.queryForList("""
                SELECT s.member_id FROM member_weather_notification_settings s
                WHERE s.enabled = TRUE AND s.member_id > ?
                    AND EXISTS (SELECT 1 FROM weather_notification_devices d WHERE d.member_id = s.member_id AND d.active = TRUE)
                ORDER BY s.member_id LIMIT ?
                """, Long.class, lastMemberId, limit);
    }

    public List<WeatherDevice> devices(final long memberId) {
        return jdbc.query("SELECT * FROM weather_notification_devices WHERE member_id = ? ORDER BY installation_id",
                this::mapDevice, memberId);
    }

    public Optional<WeatherDevice> device(final UUID installationId) {
        return jdbc.query("SELECT * FROM weather_notification_devices WHERE installation_id = ?",
                this::mapDevice, installationId.toString()).stream().findFirst();
    }

    public int activeDeviceCountForRegistration(final long memberId, final Instant now) {
        // 같은 회원의 동시 신규 등록을 직렬화한다. 기존 동의 값은 바꾸지 않는다.
        jdbc.update("""
                INSERT INTO member_weather_notification_settings (member_id, enabled, updated_at)
                VALUES (?, FALSE, ?)
                ON DUPLICATE KEY UPDATE member_id = member_weather_notification_settings.member_id
                """, memberId, utc(now));
        // REPEATABLE READ의 이전 스냅샷 대신, 앞선 등록 트랜잭션이 완료한 최신 개수를 읽는다.
        return jdbc.queryForList("""
                SELECT installation_id FROM weather_notification_devices
                WHERE member_id = ? AND active = TRUE FOR UPDATE
                """, String.class, memberId).size();
    }

    public void register(final WeatherDevice device, final String tokenHash) {
        // 소유자 변경은 서비스에서 설치 비밀키를 검증한 경우에만 허용한다.
        jdbc.update("""
                INSERT INTO weather_notification_devices
                    (installation_id, member_id, installation_secret_hash, token, token_hash, platform, permission, active, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, device.installationId().toString(), device.memberId(), device.secretHash(), device.token(), tokenHash,
                device.platform().name(), device.permission().name(), device.active(), utc(device.updatedAt()));
    }

    public int replace(final WeatherDevice device, final String tokenHash, final String expectedSecretHash, final long expectedVersion) {
        return jdbc.update("""
                UPDATE weather_notification_devices SET member_id = ?, token = ?, token_hash = ?, platform = ?, permission = ?,
                    active = ?, updated_at = ?, registration_version = registration_version + 1
                WHERE installation_id = ? AND installation_secret_hash = ? AND registration_version = ?
                """, device.memberId(), device.token(), tokenHash, device.platform().name(), device.permission().name(),
                device.active(), utc(device.updatedAt()), device.installationId().toString(), expectedSecretHash, expectedVersion);
    }

    public void revoke(final long memberId, final UUID installationId, final Instant now) {
        jdbc.update("""
                UPDATE weather_notification_devices SET token = NULL, token_hash = NULL, active = FALSE, permission = 'DENIED',
                    registration_version = registration_version + 1, updated_at = ? WHERE installation_id = ? AND member_id = ?
                """, utc(now), installationId.toString(), memberId);
    }

    public void invalidateToken(final UUID installationId, final long version, final Instant now) {
        jdbc.update("""
                UPDATE weather_notification_devices SET token = NULL, token_hash = NULL, active = FALSE, updated_at = ?
                WHERE installation_id = ? AND registration_version = ?
                """, utc(now), installationId.toString(), version);
    }

    private WeatherDevice mapDevice(final ResultSet rs, final int row) throws SQLException {
        return new WeatherDevice(UUID.fromString(rs.getString("installation_id")), rs.getLong("member_id"),
                rs.getString("installation_secret_hash"), rs.getString("token"), Platform.valueOf(rs.getString("platform")),
                Permission.valueOf(rs.getString("permission")), rs.getBoolean("active"), rs.getLong("registration_version"),
                rs.getObject("updated_at", LocalDateTime.class).toInstant(ZoneOffset.UTC));
    }

    private LocalDateTime utc(final Instant instant) {
        return LocalDateTime.ofInstant(instant, ZoneOffset.UTC);
    }
}
