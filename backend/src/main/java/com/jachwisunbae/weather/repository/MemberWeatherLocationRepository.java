package com.jachwisunbae.weather.repository;

import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.MemberWeatherLocation;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class MemberWeatherLocationRepository {
    private final JdbcTemplate jdbc;

    public MemberWeatherLocationRepository(final JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<MemberWeatherLocation> find(final long memberId) {
        return jdbc.query("""
                SELECT grid_x, grid_y, updated_at
                FROM member_weather_locations WHERE member_id = ?
                """, (rs, index) -> new MemberWeatherLocation(new GridPoint(rs.getInt("grid_x"), rs.getInt("grid_y")),
                        rs.getObject("updated_at", LocalDateTime.class).toInstant(ZoneOffset.UTC)),
                memberId).stream().findFirst();
    }

    public void sync(final long memberId, final GridPoint grid, final Instant updatedAt) {
        jdbc.update("""
                INSERT INTO member_weather_locations (member_id, grid_x, grid_y, updated_at)
                VALUES (?, ?, ?, ?) AS incoming
                ON DUPLICATE KEY UPDATE
                    grid_x = incoming.grid_x,
                    grid_y = incoming.grid_y,
                    updated_at = incoming.updated_at
                """, memberId, grid.nx(), grid.ny(), utc(updatedAt));
    }

    public void delete(final long memberId) {
        jdbc.update("DELETE FROM member_weather_locations WHERE member_id = ?", memberId);
    }

    private LocalDateTime utc(final Instant instant) {
        return LocalDateTime.ofInstant(instant, ZoneOffset.UTC);
    }
}
