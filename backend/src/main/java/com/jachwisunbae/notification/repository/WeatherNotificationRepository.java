package com.jachwisunbae.notification.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.notification.domain.LifeWeatherReport.Notice;
import com.jachwisunbae.notification.domain.NotificationSlot;
import com.jachwisunbae.notification.domain.WeatherNotification;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class WeatherNotificationRepository {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public WeatherNotificationRepository(final JdbcTemplate jdbc, final ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public boolean saveIfAbsent(final WeatherNotification n) {
        try {
            jdbc.update("""
                    INSERT INTO weather_notifications (notification_id, member_id, send_date, slot, target_date,
                        grid_x, grid_y, title, body, notices, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, n.notificationId().toString(), n.memberId(), n.sendDate(), n.slot().name(), n.targetDate(),
                    n.grid().nx(), n.grid().ny(), n.title(), n.body(), json.writeValueAsString(n.notices()),
                    LocalDateTime.ofInstant(n.createdAt(), ZoneOffset.UTC));
            return true;
        } catch (DuplicateKeyException exception) {
            return false;
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("생활 날씨 안내 저장 실패");
        }
    }

    public Optional<WeatherNotification> findOwned(final long memberId, final UUID id) {
        return jdbc.query("SELECT * FROM weather_notifications WHERE member_id = ? AND notification_id = ?",
                this::map, memberId, id.toString()).stream().findFirst();
    }

    private WeatherNotification map(final ResultSet rs, final int row) throws SQLException {
        try {
            return new WeatherNotification(UUID.fromString(rs.getString("notification_id")), rs.getLong("member_id"),
                    rs.getObject("send_date", LocalDate.class), NotificationSlot.valueOf(rs.getString("slot")),
                    rs.getObject("target_date", LocalDate.class), new GridPoint(rs.getInt("grid_x"), rs.getInt("grid_y")),
                    rs.getString("title"), rs.getString("body"), json.readValue(rs.getString("notices"),
                            new TypeReference<List<Notice>>() { }),
                    rs.getObject("created_at", LocalDateTime.class).toInstant(ZoneOffset.UTC));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("생활 날씨 안내 조회 실패");
        }
    }
}
