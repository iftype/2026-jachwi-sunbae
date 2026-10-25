package com.jachwisunbae.weather.notification.repository;

import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.notification.domain.NotificationSlot;
import com.jachwisunbae.weather.notification.domain.PreparedWeatherNotification;
import com.jachwisunbae.weather.notification.domain.WeatherDelivery;
import com.jachwisunbae.weather.notification.domain.WeatherDelivery.Status;
import com.jachwisunbae.weather.notification.domain.WeatherDevice;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class WeatherNotificationRepository {
    private final JdbcTemplate jdbc;

    public WeatherNotificationRepository(final JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public PreparedWeatherNotification saveIfAbsent(final PreparedWeatherNotification n, final List<WeatherDevice> devices) {
        jdbc.update("""
                INSERT INTO weather_notifications (notification_id, member_id, send_date, slot, target_date,
                    grid_x, grid_y, location_observed_at, prepared_at, expires_at, snapshot)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE notification_id = weather_notifications.notification_id
                """, n.notificationId().toString(), n.memberId(), n.sendDate(), n.slot().name(), n.targetDate(), n.grid().nx(),
                n.grid().ny(), utc(n.locationObservedAt()), utc(n.preparedAt()), utc(n.expiresAt()), n.snapshot());
        PreparedWeatherNotification saved = jdbc.query("""
                SELECT * FROM weather_notifications WHERE member_id = ? AND send_date = ? AND slot = ? FOR UPDATE
                """, this::notification, n.memberId(), n.sendDate(), n.slot().name()).getFirst();
        if (saved.notificationId().equals(n.notificationId())) {
            for (WeatherDevice device : devices) {
                jdbc.update("""
                        INSERT INTO weather_notification_deliveries
                            (notification_id, installation_id, registration_version, next_attempt_at)
                        VALUES (?, ?, ?, ?)
                        """, n.notificationId().toString(), device.installationId().toString(), device.version(), utc(n.preparedAt()));
            }
        }
        return saved;
    }

    public Optional<PreparedWeatherNotification> find(final long memberId, final LocalDate date, final NotificationSlot slot) {
        return jdbc.query("SELECT * FROM weather_notifications WHERE member_id = ? AND send_date = ? AND slot = ?",
                this::notification, memberId, date, slot.name()).stream().findFirst();
    }

    public Optional<PreparedWeatherNotification> findOwned(final long memberId, final UUID id) {
        return jdbc.query("SELECT * FROM weather_notifications WHERE member_id = ? AND notification_id = ?",
                this::notification, memberId, id.toString()).stream().findFirst();
    }

    public List<PreparedWeatherNotification> recent(final long memberId, final int limit) {
        return jdbc.query("SELECT * FROM weather_notifications WHERE member_id = ? ORDER BY prepared_at DESC LIMIT ?",
                this::notification, memberId, limit);
    }

    public List<WeatherDelivery> deliveries(final UUID id) {
        return jdbc.query("SELECT * FROM weather_notification_deliveries WHERE notification_id = ? ORDER BY installation_id",
                this::delivery, id.toString());
    }

    // FCM 요청 전에 짧은 독립 트랜잭션으로 발송권을 확정한다. 수신 해제·위치 해제·회원 이전을 재검사한다.
    public boolean claim(final WeatherDelivery delivery, final Instant now, final Instant oldestLocation) {
        return jdbc.update("""
                UPDATE weather_notification_deliveries d
                JOIN weather_notifications n ON n.notification_id = d.notification_id
                JOIN member_weather_notification_settings s ON s.member_id = n.member_id
                JOIN weather_notification_devices v ON v.installation_id = d.installation_id
                JOIN member_weather_locations l ON l.member_id = n.member_id
                SET d.status = 'SENDING', d.attempts = d.attempts + 1, d.claimed_at = ?, d.error_code = NULL
                WHERE d.notification_id = ? AND d.installation_id = ? AND d.status IN ('PENDING', 'RETRY')
                    AND d.next_attempt_at <= ? AND n.expires_at > ? AND s.enabled = TRUE
                    AND v.member_id = n.member_id AND v.active = TRUE AND v.permission = 'GRANTED' AND v.token IS NOT NULL
                    AND v.registration_version = d.registration_version
                    AND l.grid_x = n.grid_x AND l.grid_y = n.grid_y
                    AND l.location_observed_at >= ? AND l.location_observed_at <= ?
                """, utc(now), delivery.notificationId().toString(), delivery.installationId().toString(), utc(now), utc(now),
                utc(oldestLocation), utc(now.plusSeconds(60))) == 1;
    }

    public void cancelUnclaimed(final WeatherDelivery delivery, final Instant now) {
        jdbc.update("""
                UPDATE weather_notification_deliveries SET status = 'CANCELLED', error_code = 'ELIGIBILITY_CHANGED', finished_at = ?
                WHERE notification_id = ? AND installation_id = ? AND status IN ('PENDING', 'RETRY') AND next_attempt_at <= ?
                """, utc(now), delivery.notificationId().toString(), delivery.installationId().toString(), utc(now));
    }

    public void finish(final WeatherDelivery delivery, final Status status, final Instant now,
                       final Instant nextAttempt, final String providerId, final String code) {
        jdbc.update("""
                UPDATE weather_notification_deliveries SET status = ?, finished_at = ?, next_attempt_at = ?,
                    provider_message_id = ?, error_code = ?
                WHERE notification_id = ? AND installation_id = ? AND status = 'SENDING' AND attempts = ?
                """, status.name(), utc(now), utc(nextAttempt), providerId, code, delivery.notificationId().toString(),
                delivery.installationId().toString(), delivery.attempts() + 1);
    }

    public void recover(final Instant now) {
        // 외부 전송과 DB 완료 사이의 중단은 성공 여부를 알 수 없으므로 자동 재전송하지 않는다.
        jdbc.update("""
                UPDATE weather_notification_deliveries SET status = 'UNKNOWN', error_code = 'INTERRUPTED_OR_TIMED_OUT', finished_at = ?
                WHERE status = 'SENDING' AND claimed_at < ?
                """, utc(now), utc(now.minusSeconds(300)));
        jdbc.update("""
                UPDATE weather_notification_deliveries d JOIN weather_notifications n USING (notification_id)
                SET d.status = 'CANCELLED', d.error_code = 'SLOT_EXPIRED', d.finished_at = ?
                WHERE d.status IN ('PENDING', 'RETRY') AND n.expires_at <= ?
                """, utc(now), utc(now));
    }

    public int receipt(final long memberId, final UUID notificationId, final UUID installationId,
                       final boolean opened, final Instant now) {
        return jdbc.update("""
                UPDATE weather_notification_deliveries d
                JOIN weather_notifications n ON n.notification_id = d.notification_id
                JOIN weather_notification_devices v ON v.installation_id = d.installation_id
                SET d.received_at = COALESCE(d.received_at, ?),
                    d.opened_at = IF(?, COALESCE(d.opened_at, ?), d.opened_at)
                WHERE d.notification_id = ? AND d.installation_id = ? AND n.member_id = ? AND v.member_id = ?
                    AND d.status IN ('SENDING', 'ACCEPTED', 'UNKNOWN')
                """, utc(now), opened, utc(now), notificationId.toString(), installationId.toString(), memberId, memberId);
    }

    private PreparedWeatherNotification notification(final ResultSet rs, final int row) throws SQLException {
        return new PreparedWeatherNotification(UUID.fromString(rs.getString("notification_id")), rs.getLong("member_id"),
                rs.getObject("send_date", LocalDate.class), NotificationSlot.valueOf(rs.getString("slot")),
                rs.getObject("target_date", LocalDate.class), new GridPoint(rs.getInt("grid_x"), rs.getInt("grid_y")),
                instant(rs, "location_observed_at"), instant(rs, "prepared_at"), instant(rs, "expires_at"), rs.getString("snapshot"));
    }

    private WeatherDelivery delivery(final ResultSet rs, final int row) throws SQLException {
        return new WeatherDelivery(UUID.fromString(rs.getString("notification_id")), UUID.fromString(rs.getString("installation_id")),
                rs.getLong("registration_version"), Status.valueOf(rs.getString("status")), rs.getInt("attempts"),
                instant(rs, "next_attempt_at"), instant(rs, "claimed_at"), instant(rs, "finished_at"),
                rs.getString("provider_message_id"), rs.getString("error_code"), instant(rs, "received_at"), instant(rs, "opened_at"));
    }

    private Instant instant(final ResultSet rs, final String name) throws SQLException {
        LocalDateTime value = rs.getObject(name, LocalDateTime.class);
        return value == null ? null : value.toInstant(ZoneOffset.UTC);
    }

    private LocalDateTime utc(final Instant value) {
        return LocalDateTime.ofInstant(value, ZoneOffset.UTC);
    }
}
