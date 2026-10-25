package com.jachwisunbae.weather.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.spy;

import com.jachwisunbae.weather.repository.JdbcWeatherForecastRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.stream.IntStream;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class WeatherCleanupIntegrationTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 23);
    private static final LocalDateTime MIDNIGHT = TODAY.atStartOfDay();
    // KST 오늘 오전 9시. 오늘 새벽의 예보도 보존해야 한다.
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-23T00:00:00Z"), ZoneOffset.UTC);

    @Container
    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.10");
    private static DataSource dataSource;
    private static JdbcTemplate jdbc;
    private JdbcWeatherForecastRepository repository;

    @BeforeAll
    static void migrate() {
        String url = MYSQL.getJdbcUrl();
        dataSource = new DriverManagerDataSource(url + (url.contains("?") ? "&" : "?")
                + "connectionTimeZone=%2B00:00&forceConnectionTimeZoneToSession=true&rewriteBatchedStatements=true",
                MYSQL.getUsername(), MYSQL.getPassword());
        Flyway.configure().dataSource(dataSource).load().migrate();
        jdbc = new JdbcTemplate(dataSource);
    }

    @BeforeEach
    void clear() {
        jdbc.update("DELETE FROM weather_forecasts");
        jdbc.update("DELETE FROM weather_daily_forecasts");
        repository = new JdbcWeatherForecastRepository(jdbc);
    }

    @Test
    @DisplayName("어제 23시까지만 삭제하고 오늘 00시·오늘의 지난 시간·미래 값과 출처를 모두 보존한다")
    void preservesTodayAndFuture() {
        seed(1);
        var expectedHourly = jdbc.queryForList("SELECT * FROM weather_forecasts WHERE forecast_at >= ? ORDER BY forecast_at", MIDNIGHT);
        var expectedDaily = jdbc.queryForList("SELECT * FROM weather_daily_forecasts WHERE forecast_date >= ? ORDER BY forecast_date", TODAY);

        service(repository).cleanup();

        assertThat(jdbc.queryForList("SELECT * FROM weather_forecasts ORDER BY forecast_at")).isEqualTo(expectedHourly);
        assertThat(jdbc.queryForList("SELECT * FROM weather_daily_forecasts ORDER BY forecast_date")).isEqualTo(expectedDaily);

        service(repository).cleanup();
    }

    @Test
    @DisplayName("일별 삭제가 실패하면 앞선 시간별 삭제도 롤백되고 다시 실행할 수 있다")
    void rollsBackBothTables() {
        seed(1);
        var hourlyBefore = jdbc.queryForList("SELECT * FROM weather_forecasts ORDER BY forecast_at");
        var dailyBefore = jdbc.queryForList("SELECT * FROM weather_daily_forecasts ORDER BY forecast_date");
        JdbcWeatherForecastRepository failing = spy(repository);
        doThrow(new DataAccessResourceFailureException("test daily delete failure"))
                .doCallRealMethod().when(failing).deleteDailyBefore(TODAY);
        WeatherCleanupService service = service(failing);

        assertThatThrownBy(service::cleanup).isInstanceOf(DataAccessResourceFailureException.class);

        assertThat(jdbc.queryForList("SELECT * FROM weather_forecasts ORDER BY forecast_at")).isEqualTo(hourlyBefore);
        assertThat(jdbc.queryForList("SELECT * FROM weather_daily_forecasts ORDER BY forecast_date")).isEqualTo(dailyBefore);
        service.cleanup();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM weather_forecasts", Integer.class)).isEqualTo(3);
    }

    @Test
    @DisplayName("빈 DB의 정리는 두 테이블 모두 0건으로 정상 종료한다")
    void cleansEmptyDatabase() {
        service(repository).cleanup();
    }

    private WeatherCleanupService service(final JdbcWeatherForecastRepository target) {
        return com.jachwisunbae.weather.support.WeatherTransactionTestSupport.transactional(new WeatherCleanupService(target, CLOCK), dataSource);
    }

    private void seed(final int grids) {
        List<Integer> indices = IntStream.range(0, grids).boxed().toList();
        for (LocalDateTime target : List.of(MIDNIGHT.minusDays(2), MIDNIGHT.minusHours(1), MIDNIGHT,
                MIDNIGHT.plusHours(1), MIDNIGHT.plusDays(1))) {
            jdbc.batchUpdate("""
                    INSERT INTO weather_forecasts (grid_x, grid_y, forecast_at, published_at, tmp, collected_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, indices, 1000, (statement, index) -> {
                statement.setInt(1, index % 149 + 1);
                statement.setInt(2, index / 149 + 1);
                statement.setObject(3, target);
                statement.setObject(4, MIDNIGHT.minusDays(2).minusHours(1));
                statement.setObject(5, index % 2 == 0 ? null : 0.0);
                // 과거 대상도 오늘 다시 수집된 것처럼 넣어 수집시각으로 삭제하지 않음을 검증한다.
                statement.setObject(6, MIDNIGHT.plusHours(8));
            });
        }
        for (LocalDate target : List.of(TODAY.minusDays(1), TODAY, TODAY.plusDays(1))) {
            jdbc.batchUpdate("""
                    INSERT INTO weather_daily_forecasts
                        (grid_x, grid_y, forecast_date, tmn, tmn_published_at, tmn_collected_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, indices, 1000, (statement, index) -> {
                statement.setInt(1, index % 149 + 1);
                statement.setInt(2, index / 149 + 1);
                statement.setObject(3, target);
                statement.setObject(4, index % 2 == 0 ? null : 0.0);
                statement.setObject(5, MIDNIGHT.minusDays(2).minusHours(1));
                statement.setObject(6, MIDNIGHT.plusHours(8));
            });
        }
    }
}
