package com.jachwisunbae.weather.repository;

import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.WeatherElement;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class WeatherForecastQueryRepository {
    private final JdbcTemplate jdbc;

    public WeatherForecastQueryRepository(final JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // 1개 격자의 1일 범위만 PK로 읽는다. 완료 기록 없는 기존 자료도 숨기지 않고 상태 판정에 전달한다.
    public List<StoredReading> findHourly(final GridPoint grid, final LocalDate date) {
        return jdbc.query("""
                SELECT f.*, p.started_at, p.completed_at
                FROM weather_forecasts f
                LEFT JOIN weather_collection_publications p ON p.published_at = f.published_at
                WHERE f.grid_x = ? AND f.grid_y = ? AND f.forecast_at >= ? AND f.forecast_at < ?
                ORDER BY f.forecast_at
                """, (rs, index) -> {
                    List<StoredReading> readings = new ArrayList<>();
                    for (WeatherElement element : WeatherElement.hourlyElements()) {
                        readings.add(new StoredReading(rs.getObject("forecast_at", LocalDateTime.class), element,
                                rs.getObject(element.name().toLowerCase(Locale.ROOT), Double.class),
                                rs.getObject("published_at", LocalDateTime.class),
                                rs.getObject("collected_at", LocalDateTime.class),
                                rs.getObject("started_at", LocalDateTime.class),
                                rs.getObject("completed_at", LocalDateTime.class)));
                    }
                    return readings;
                }, grid.nx(), grid.ny(), date.atStartOfDay(), date.plusDays(1).atStartOfDay())
                .stream().flatMap(List::stream).toList();
    }

    public List<StoredReading> findDaily(final GridPoint grid, final LocalDate date) {
        return jdbc.query("""
                SELECT 'TMN' AS element, f.tmn AS value, f.tmn_published_at AS published_at,
                       f.tmn_collected_at AS collected_at, p.started_at, p.completed_at
                FROM weather_daily_forecasts f
                LEFT JOIN weather_collection_publications p ON p.published_at = f.tmn_published_at
                WHERE f.grid_x = ? AND f.grid_y = ? AND f.forecast_date = ?
                UNION ALL
                SELECT 'TMX', f.tmx, f.tmx_published_at, f.tmx_collected_at, p.started_at, p.completed_at
                FROM weather_daily_forecasts f
                LEFT JOIN weather_collection_publications p ON p.published_at = f.tmx_published_at
                WHERE f.grid_x = ? AND f.grid_y = ? AND f.forecast_date = ?
                """, (rs, index) -> new StoredReading(date.atStartOfDay(), WeatherElement.valueOf(rs.getString("element")),
                rs.getObject("value", Double.class), rs.getObject("published_at", LocalDateTime.class),
                rs.getObject("collected_at", LocalDateTime.class), rs.getObject("started_at", LocalDateTime.class),
                rs.getObject("completed_at", LocalDateTime.class)), grid.nx(), grid.ny(), date, grid.nx(), grid.ny(), date);
    }

    public record StoredReading(LocalDateTime forecastAt, WeatherElement element, Double value,
                                LocalDateTime publishedAt, LocalDateTime collectedAt,
                                LocalDateTime startedAt, LocalDateTime completedAt) {
        public boolean isVerified(final LocalDateTime now) {
            return publishedAt != null && collectedAt != null && startedAt != null && completedAt != null
                    && !publishedAt.isAfter(now) && !collectedAt.isBefore(publishedAt)
                    && !collectedAt.isBefore(startedAt) && !collectedAt.isAfter(completedAt)
                    && !completedAt.isAfter(now);
        }
    }
}
