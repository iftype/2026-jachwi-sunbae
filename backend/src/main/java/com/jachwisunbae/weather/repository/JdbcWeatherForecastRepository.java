package com.jachwisunbae.weather.repository;

import com.jachwisunbae.weather.domain.DailyForecast;
import com.jachwisunbae.weather.domain.DailyTemperature;
import com.jachwisunbae.weather.domain.HourlyForecast;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Types;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class JdbcWeatherForecastRepository {

    private static final int BATCH_SIZE = 1000;

    // 모든 값과 수집시각을 기존 발표시각으로 비교한 뒤 발표시각을 마지막에 갱신한다.
    private static final String UPSERT_HOURLY = """
            INSERT INTO weather_forecasts
                (grid_x, grid_y, forecast_at, published_at, tmp, sky, pty, pop, pcp, sno, reh, wsd, collected_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) AS incoming
            ON DUPLICATE KEY UPDATE
                tmp = IF(incoming.published_at >= weather_forecasts.published_at, incoming.tmp, weather_forecasts.tmp),
                sky = IF(incoming.published_at >= weather_forecasts.published_at, incoming.sky, weather_forecasts.sky),
                pty = IF(incoming.published_at >= weather_forecasts.published_at, incoming.pty, weather_forecasts.pty),
                pop = IF(incoming.published_at >= weather_forecasts.published_at, incoming.pop, weather_forecasts.pop),
                pcp = IF(incoming.published_at >= weather_forecasts.published_at, incoming.pcp, weather_forecasts.pcp),
                sno = IF(incoming.published_at >= weather_forecasts.published_at, incoming.sno, weather_forecasts.sno),
                reh = IF(incoming.published_at >= weather_forecasts.published_at, incoming.reh, weather_forecasts.reh),
                wsd = IF(incoming.published_at >= weather_forecasts.published_at, incoming.wsd, weather_forecasts.wsd),
                collected_at = IF(incoming.published_at >= weather_forecasts.published_at,
                    incoming.collected_at, weather_forecasts.collected_at),
                published_at = GREATEST(incoming.published_at, weather_forecasts.published_at)
            """;

    // 미수집 요소는 기존 값을 유지한다. 수집 결과의 value가 NULL인 경우에는 결측 정정으로 반영한다.
    private static final String UPSERT_DAILY = """
            INSERT INTO weather_daily_forecasts
                (grid_x, grid_y, forecast_date, tmn, tmn_published_at, tmn_collected_at,
                 tmx, tmx_published_at, tmx_collected_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) AS incoming
            ON DUPLICATE KEY UPDATE
                tmn = IF(incoming.tmn_published_at IS NOT NULL AND
                    (weather_daily_forecasts.tmn_published_at IS NULL
                     OR incoming.tmn_published_at >= weather_daily_forecasts.tmn_published_at),
                    incoming.tmn, weather_daily_forecasts.tmn),
                tmn_collected_at = IF(incoming.tmn_published_at IS NOT NULL AND
                    (weather_daily_forecasts.tmn_published_at IS NULL
                     OR incoming.tmn_published_at >= weather_daily_forecasts.tmn_published_at),
                    incoming.tmn_collected_at, weather_daily_forecasts.tmn_collected_at),
                tmn_published_at = IF(incoming.tmn_published_at IS NOT NULL AND
                    (weather_daily_forecasts.tmn_published_at IS NULL
                     OR incoming.tmn_published_at >= weather_daily_forecasts.tmn_published_at),
                    incoming.tmn_published_at, weather_daily_forecasts.tmn_published_at),
                tmx = IF(incoming.tmx_published_at IS NOT NULL AND
                    (weather_daily_forecasts.tmx_published_at IS NULL
                     OR incoming.tmx_published_at >= weather_daily_forecasts.tmx_published_at),
                    incoming.tmx, weather_daily_forecasts.tmx),
                tmx_collected_at = IF(incoming.tmx_published_at IS NOT NULL AND
                    (weather_daily_forecasts.tmx_published_at IS NULL
                     OR incoming.tmx_published_at >= weather_daily_forecasts.tmx_published_at),
                    incoming.tmx_collected_at, weather_daily_forecasts.tmx_collected_at),
                tmx_published_at = IF(incoming.tmx_published_at IS NOT NULL AND
                    (weather_daily_forecasts.tmx_published_at IS NULL
                     OR incoming.tmx_published_at >= weather_daily_forecasts.tmx_published_at),
                    incoming.tmx_published_at, weather_daily_forecasts.tmx_published_at)
            """;

    private final JdbcTemplate jdbcTemplate;

    public JdbcWeatherForecastRepository(final JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void startCollection(final LocalDateTime publishedAt) {
        jdbcTemplate.update("""
                INSERT INTO weather_collection_publications (published_at, completed_at)
                VALUES (?, NULL)
                ON DUPLICATE KEY UPDATE completed_at = NULL
                """, publishedAt);
    }

    public void completeCollection(final LocalDateTime publishedAt, final LocalDateTime completedAt) {
        jdbcTemplate.update("UPDATE weather_collection_publications SET completed_at = ? WHERE published_at = ?",
                completedAt, publishedAt);
    }

    public int deleteHourlyBefore(final LocalDateTime cutoff) {
        return jdbcTemplate.update("DELETE FROM weather_forecasts WHERE forecast_at < ?", cutoff);
    }

    public int deleteDailyBefore(final LocalDate cutoff) {
        return jdbcTemplate.update("DELETE FROM weather_daily_forecasts WHERE forecast_date < ?", cutoff);
    }

    @Transactional
    public void upsertHourly(final List<HourlyForecast> forecasts) {
        if (forecasts.isEmpty()) {
            return;
        }
        jdbcTemplate.batchUpdate(UPSERT_HOURLY, forecasts, BATCH_SIZE, (statement, forecast) -> {
            statement.setInt(1, forecast.point().nx());
            statement.setInt(2, forecast.point().ny());
            statement.setObject(3, forecast.times().forecastAt());
            statement.setObject(4, forecast.times().publishedAt());
            statement.setObject(5, forecast.tmp(), Types.DOUBLE);
            statement.setObject(6, forecast.sky(), Types.DOUBLE);
            statement.setObject(7, forecast.pty(), Types.DOUBLE);
            statement.setObject(8, forecast.pop(), Types.DOUBLE);
            statement.setObject(9, forecast.pcp(), Types.DOUBLE);
            statement.setObject(10, forecast.sno(), Types.DOUBLE);
            statement.setObject(11, forecast.reh(), Types.DOUBLE);
            statement.setObject(12, forecast.wsd(), Types.DOUBLE);
            statement.setObject(13, forecast.collectedAt());
        });
    }

    @Transactional
    public void upsertDaily(final List<DailyForecast> forecasts) {
        if (forecasts.isEmpty()) {
            return;
        }
        jdbcTemplate.batchUpdate(UPSERT_DAILY, forecasts, BATCH_SIZE, (statement, forecast) -> {
            statement.setInt(1, forecast.point().nx());
            statement.setInt(2, forecast.point().ny());
            statement.setObject(3, forecast.forecastDate());
            bindDailyTemperature(statement, 4, forecast.tmn());
            bindDailyTemperature(statement, 7, forecast.tmx());
        });
    }

    private void bindDailyTemperature(final PreparedStatement statement, final int index,
                                      final DailyTemperature temperature) throws SQLException {
        statement.setObject(index, temperature == null ? null : temperature.value(), Types.DOUBLE);
        statement.setObject(index + 1, temperature == null ? null : temperature.publishedAt(), Types.TIMESTAMP);
        statement.setObject(index + 2, temperature == null ? null : temperature.collectedAt(), Types.TIMESTAMP);
    }
}
