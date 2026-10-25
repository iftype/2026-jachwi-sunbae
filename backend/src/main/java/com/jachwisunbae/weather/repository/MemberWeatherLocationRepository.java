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
                SELECT grid_x, grid_y, location_observed_at, synced_at
                FROM member_weather_locations WHERE member_id = ?
                """, (rs, index) -> {
            Integer x = rs.getObject("grid_x", Integer.class);
            LocalDateTime observed = rs.getObject("location_observed_at", LocalDateTime.class);
            return new MemberWeatherLocation(x == null ? null : new GridPoint(x, rs.getInt("grid_y")),
                    observed == null ? null : observed.toInstant(ZoneOffset.UTC),
                    rs.getObject("synced_at", LocalDateTime.class).toInstant(ZoneOffset.UTC));
        }, memberId).stream().findFirst();
    }

    public void sync(final long memberId, final GridPoint grid, final Instant observedAt, final Instant syncedAt) {
        // 비교에 사용하는 location_observed_at은 마지막에 갱신한다. 해제 전에 획득한 지연 요청도 무시한다.
        jdbc.update("""
                INSERT INTO member_weather_locations (member_id, grid_x, grid_y, location_observed_at, synced_at)
                VALUES (?, ?, ?, ?, ?) AS incoming
                ON DUPLICATE KEY UPDATE
                    grid_x = IF(%s, incoming.grid_x, member_weather_locations.grid_x),
                    grid_y = IF(%s, incoming.grid_y, member_weather_locations.grid_y),
                    synced_at = IF(%s, incoming.synced_at, member_weather_locations.synced_at),
                    location_observed_at = IF(%s, incoming.location_observed_at, member_weather_locations.location_observed_at)
                """.formatted(newer(), newer(), newer(), newer()), memberId, grid.nx(), grid.ny(), utc(observedAt), utc(syncedAt));
    }

    private String newer() {
        return """
                incoming.location_observed_at > COALESCE(member_weather_locations.location_observed_at, '1000-01-01')
                AND incoming.location_observed_at > COALESCE(member_weather_locations.invalidated_at, '1000-01-01')
                """;
    }

    public void invalidate(final long memberId, final Instant now) {
        // 행이 없어도 해제 시각을 보존해 진행 중이던 오래된 PUT이 위치를 되살리지 못하게 한다.
        jdbc.update("""
                INSERT INTO member_weather_locations (member_id, synced_at, invalidated_at)
                VALUES (?, ?, ?) AS incoming
                ON DUPLICATE KEY UPDATE grid_x = NULL, grid_y = NULL,
                    synced_at = incoming.synced_at, invalidated_at = incoming.invalidated_at
                """, memberId, utc(now), utc(now));
    }

    private LocalDateTime utc(final Instant instant) {
        return LocalDateTime.ofInstant(instant, ZoneOffset.UTC);
    }
}
