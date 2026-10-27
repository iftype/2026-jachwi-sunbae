package com.jachwisunbae.weather.repository;

import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.service.dto.result.WeatherForecastResult.Daily;
import com.jachwisunbae.weather.service.dto.result.WeatherForecastResult.Hour;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class WeatherForecastQueryRepository {
    private final JdbcTemplate jdbc;

    public WeatherForecastQueryRepository(final JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // PK로 한 격자·하루만 읽는다. 미완료 발표분은 값으로 노출하지 않는다.
    public List<Hour> findHourly(final GridPoint grid, final LocalDate date) {
        return jdbc.query("""
                SELECT f.* FROM weather_forecasts f
                JOIN weather_collection_publications p ON p.published_at = f.published_at AND p.completed_at IS NOT NULL
                WHERE f.grid_x = ? AND f.grid_y = ? AND f.forecast_at >= ? AND f.forecast_at < ?
                ORDER BY f.forecast_at
                """, (rs, row) -> new Hour(rs.getObject("forecast_at", LocalDateTime.class),
                rs.getObject("published_at", LocalDateTime.class), rs.getObject("tmp", Double.class),
                rs.getObject("sky", Double.class), rs.getObject("pty", Double.class), rs.getObject("pop", Double.class),
                rs.getObject("pcp", Double.class), rs.getObject("sno", Double.class), rs.getObject("reh", Double.class),
                rs.getObject("wsd", Double.class)), grid.nx(), grid.ny(), date.atStartOfDay(), date.plusDays(1).atStartOfDay());
    }

    public Daily findDaily(final GridPoint grid, final LocalDate date) {
        return jdbc.query("""
                SELECT f.*,
                       mn.completed_at IS NOT NULL AS minimum_completed,
                       mx.completed_at IS NOT NULL AS maximum_completed
                FROM weather_daily_forecasts f
                LEFT JOIN weather_collection_publications mn ON mn.published_at = f.tmn_published_at
                LEFT JOIN weather_collection_publications mx ON mx.published_at = f.tmx_published_at
                WHERE f.grid_x = ? AND f.grid_y = ? AND f.forecast_date = ?
                """, (rs, row) -> new Daily(
                rs.getBoolean("minimum_completed") ? rs.getObject("tmn", Double.class) : null,
                rs.getBoolean("maximum_completed") ? rs.getObject("tmx", Double.class) : null,
                rs.getBoolean("minimum_completed") ? rs.getObject("tmn_published_at", LocalDateTime.class) : null,
                rs.getBoolean("maximum_completed") ? rs.getObject("tmx_published_at", LocalDateTime.class) : null),
                grid.nx(), grid.ny(), date).stream().findFirst().orElse(new Daily(null, null, null, null));
    }
}
