package com.jachwisunbae.weather.database;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.stream.Stream;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class WeatherSchemaIntegrationTest {

    private static final LocalDateTime PUBLISHED_AT = LocalDateTime.of(2026, 10, 22, 17, 0);
    private static final LocalDateTime COLLECTED_AT = LocalDateTime.of(2026, 10, 22, 17, 15, 0, 123456000);
    private static final LocalDateTime FORECAST_AT = LocalDateTime.of(2026, 10, 22, 20, 0);
    private static final LocalDate FORECAST_DATE = LocalDate.of(2026, 10, 23);

    @Container
    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.10");

    private static JdbcTemplate jdbcTemplate;

    @BeforeAll
    static void setUpSchema() {
        DataSource dataSource = new DriverManagerDataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword());
        Flyway flyway = Flyway.configure().dataSource(dataSource).load();
        assertThat(flyway.migrate().migrationsExecuted).isEqualTo(4);
        flyway.validate();
        assertThat(flyway.migrate().migrationsExecuted).isZero();
        jdbcTemplate = new JdbcTemplate(dataSource);
    }

    @BeforeEach
    void clearForecasts() {
        jdbcTemplate.update("DELETE FROM weather_forecasts");
        jdbcTemplate.update("DELETE FROM weather_daily_forecasts");
        jdbcTemplate.update("DELETE FROM members");
    }

    @Test
    @DisplayName("위치의 4개 컬럼 계약과 나머지 6개 날씨 테이블의 기존 DDL을 유지한다")
    void matchesFinalMvpSchemaContract() throws IOException {
        // 나머지 6개 테이블은 통합 전 실제 DDL, 위치 테이블은 명시적으로 변경한 4개 컬럼 계약이다.
        try (var input = new ClassPathResource("db/weather-mvp-schema.json").getInputStream()) {
            var expected = new ObjectMapper().readTree(input).get("tables");
            var names = new ArrayList<String>();
            expected.fieldNames().forEachRemaining(names::add);
            assertThat(names).hasSize(7);
            assertThat(jdbcTemplate.queryForList("""
                    SELECT table_name FROM information_schema.tables
                    WHERE table_schema = DATABASE() AND table_name LIKE '%weather%'
                    """, String.class)).containsExactlyInAnyOrderElementsOf(names);
            for (String table : names) {
                var lines = new ArrayList<String>();
                expected.get(table).forEach(line -> lines.add(line.asText()));
                String actual = jdbcTemplate.queryForObject("SHOW CREATE TABLE `" + table + "`", (rs, row) -> rs.getString(2));
                assertThat(actual).as("columns, defaults, precision, PK/FK/UNIQUE/INDEX/CHECK and collation: %s", table)
                        .isEqualTo(String.join("\n", lines));
            }
        }
    }

    @ParameterizedTest
    @CsvSource({"NULL, 127", "60, NULL", "0, 127", "150, 127", "60, 0", "60, 254"})
    @DisplayName("저장된 회원 위치의 격자는 NULL이거나 기상청 격자 범위 밖일 수 없다")
    void rejectsMissingOrOutOfRangeMemberGrid(final String x, final String y) {
        jdbcTemplate.update("INSERT INTO members (id, nickname, created_at, updated_at) VALUES (1, '위치 회원', NOW(), NOW())");
        assertThatThrownBy(() -> jdbcTemplate.update("""
                INSERT INTO member_weather_locations (member_id, grid_x, grid_y, updated_at)
                VALUES (1, %s, %s, NOW(6))
                """.formatted(x, y))).isInstanceOf(DataAccessException.class);
    }

    @Test
    @DisplayName("회원 위치는 존재하는 회원만 참조하며 회원 삭제 시 함께 삭제된다")
    void enforcesMemberLocationForeignKeyAndCascade() {
        String insert = "INSERT INTO member_weather_locations (member_id, grid_x, grid_y, updated_at) VALUES (1, 60, 127, NOW(6))";
        assertThatThrownBy(() -> jdbcTemplate.update(insert))
                .isInstanceOf(DataAccessException.class).hasMessageContaining("fk_member_weather_location_member");
        jdbcTemplate.update("INSERT INTO members (id, nickname, created_at, updated_at) VALUES (1, '위치 회원', NOW(), NOW())");
        jdbcTemplate.update(insert);
        jdbcTemplate.update("DELETE FROM members WHERE id = 1");
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM member_weather_locations", Integer.class)).isZero();
    }

    @Test
    @DisplayName("시간별 8개 원본 숫자의 음수·소수·0·NULL과 KST 시각을 보존한다")
    void storesHourlyRawValuesAndTimes() {
        jdbcTemplate.update("""
                INSERT INTO weather_forecasts
                    (grid_x, grid_y, forecast_at, published_at, collected_at, tmp, sky, pty, pop, pcp, sno, reh, wsd)
                VALUES (60, 127, ?, ?, ?, -7.25, 1, 0, 30, 0, NULL, 65, 0.7)
                """, FORECAST_AT, PUBLISHED_AT, COLLECTED_AT);

        var row = jdbcTemplate.queryForMap("SELECT tmp, sky, pty, pop, pcp, sno, reh, wsd FROM weather_forecasts");
        assertThat(row).containsEntry("tmp", -7.25).containsEntry("sky", 1.0).containsEntry("pty", 0.0)
                .containsEntry("pop", 30.0).containsEntry("pcp", 0.0).containsEntry("sno", null)
                .containsEntry("reh", 65.0).containsEntry("wsd", 0.7);
        assertThat(jdbcTemplate.queryForObject("SELECT forecast_at FROM weather_forecasts", LocalDateTime.class))
                .isEqualTo(FORECAST_AT);
        assertThat(jdbcTemplate.queryForObject("SELECT published_at FROM weather_forecasts", LocalDateTime.class))
                .isEqualTo(PUBLISHED_AT);
        assertThat(jdbcTemplate.queryForObject("SELECT collected_at FROM weather_forecasts", LocalDateTime.class))
                .isEqualTo(COLLECTED_AT);
    }

    @Test
    @DisplayName("일별 최저·최고기온의 발표·수집시각을 독립적으로 보관한다")
    void storesDailySourcesIndependently() {
        LocalDateTime laterPublication = PUBLISHED_AT.plusHours(3);
        LocalDateTime laterCollection = COLLECTED_AT.plusHours(3);
        jdbcTemplate.update("""
                INSERT INTO weather_daily_forecasts
                    (grid_x, grid_y, forecast_date, tmn, tmn_published_at, tmn_collected_at,
                     tmx, tmx_published_at, tmx_collected_at)
                VALUES (60, 127, ?, -6.5, ?, ?, 0, ?, ?)
                """, FORECAST_DATE, PUBLISHED_AT, COLLECTED_AT, laterPublication, laterCollection);

        var row = jdbcTemplate.queryForMap("SELECT tmn, tmx FROM weather_daily_forecasts");
        assertThat(row).containsEntry("tmn", -6.5).containsEntry("tmx", 0.0);
        assertThat(jdbcTemplate.queryForObject("SELECT forecast_date FROM weather_daily_forecasts", LocalDate.class))
                .isEqualTo(FORECAST_DATE);
        assertThat(jdbcTemplate.queryForObject("SELECT tmn_published_at FROM weather_daily_forecasts", LocalDateTime.class))
                .isEqualTo(PUBLISHED_AT);
        assertThat(jdbcTemplate.queryForObject("SELECT tmn_collected_at FROM weather_daily_forecasts", LocalDateTime.class))
                .isEqualTo(COLLECTED_AT);
        assertThat(jdbcTemplate.queryForObject("SELECT tmx_published_at FROM weather_daily_forecasts", LocalDateTime.class))
                .isEqualTo(laterPublication);
        assertThat(jdbcTemplate.queryForObject("SELECT tmx_collected_at FROM weather_daily_forecasts", LocalDateTime.class))
                .isEqualTo(laterCollection);
    }

    @ParameterizedTest
    @ValueSource(strings = {"tmn", "tmx"})
    @DisplayName("일별 요소를 하나만 수집할 수 있고 응답 결측과 아직 수집하지 않은 요소를 구분한다")
    void distinguishesMissingAndUncollectedDailyValues(final String element) {
        jdbcTemplate.update("INSERT INTO weather_daily_forecasts (grid_x, grid_y, forecast_date, "
                        + element + "_published_at, " + element + "_collected_at) VALUES (60, 127, ?, ?, ?)",
                FORECAST_DATE, PUBLISHED_AT, COLLECTED_AT);

        String other = element.equals("tmn") ? "tmx" : "tmn";
        var row = jdbcTemplate.queryForMap("SELECT * FROM weather_daily_forecasts");
        assertThat(row).containsEntry(element, null).containsEntry(other, null)
                .containsEntry(other + "_published_at", null).containsEntry(other + "_collected_at", null);
        assertThat(row.get(element + "_published_at")).isNotNull();
        assertThat(row.get(element + "_collected_at")).isNotNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"weather_forecasts", "weather_daily_forecasts"})
    @DisplayName("같은 격자·대상 시각의 다른 발표분도 중복 삽입할 수 없고 다른 격자·시각은 구분한다")
    void enforcesForecastIdentity(final String table) {
        insertForecast(table, 60, 127);
        String publishedColumn = table.equals("weather_forecasts") ? "published_at" : "tmn_published_at";
        jdbcTemplate.update("UPDATE " + table + " SET " + publishedColumn + " = ?", PUBLISHED_AT.plusHours(3));

        assertThatThrownBy(() -> insertForecast(table, 60, 127)).isInstanceOf(DuplicateKeyException.class);
        insertForecast(table, 61, 127);
        insertForecast(table, 60, 128);
        if (table.equals("weather_forecasts")) {
            jdbcTemplate.update("UPDATE weather_forecasts SET forecast_at = ? WHERE grid_x = 60 AND grid_y = 127",
                    FORECAST_AT.plusHours(1));
        } else {
            jdbcTemplate.update("UPDATE weather_daily_forecasts SET forecast_date = ? WHERE grid_x = 60 AND grid_y = 127",
                    FORECAST_DATE.plusDays(1));
        }
        insertForecast(table, 60, 127);

        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class)).isEqualTo(4);
    }

    @ParameterizedTest
    @CsvSource({"1, 1", "149, 253"})
    @DisplayName("전국 격자의 첫 좌표와 마지막 좌표를 저장한다")
    void acceptsGridBoundaries(final int nx, final int ny) {
        insertForecast("weather_forecasts", nx, ny);
        insertForecast("weather_daily_forecasts", nx, ny);

        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM weather_forecasts", Integer.class)).isOne();
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM weather_daily_forecasts", Integer.class)).isOne();
    }

    @ParameterizedTest
    @CsvSource({"0, 1", "150, 1", "1, 0", "1, 254"})
    @DisplayName("격자 경계를 벗어난 좌표를 두 테이블 모두 거부한다")
    void rejectsOutOfGridCoordinates(final int nx, final int ny) {
        assertThatThrownBy(() -> insertForecast("weather_forecasts", nx, ny))
                .isInstanceOf(DataAccessException.class).hasMessageContaining("chk_weather_forecasts_grid");
        assertThatThrownBy(() -> insertForecast("weather_daily_forecasts", nx, ny))
                .isInstanceOf(DataAccessException.class).hasMessageContaining("chk_weather_daily_forecasts_grid");
    }

    @ParameterizedTest
    @MethodSource("missingSentinelCases")
    @DisplayName("10개 요소에서 결측 코드의 직접 저장을 거부하고 NULL은 허용한다")
    void rejectsMissingSentinels(final String table, final String column, final double sentinel) {
        insertForecast(table, 60, 127);

        assertThatThrownBy(() -> jdbcTemplate.update("UPDATE " + table + " SET " + column + " = ?", sentinel))
                .isInstanceOf(DataAccessException.class).hasMessageContaining("chk_" + table + "_" + column);
        jdbcTemplate.update("UPDATE " + table + " SET " + column + " = NULL");

        assertThat(jdbcTemplate.queryForObject("SELECT " + column + " FROM " + table, Double.class)).isNull();
    }

    @ParameterizedTest
    @CsvSource({
            "weather_forecasts, forecast_at, 2026-10-22 16:00:00, chk_weather_forecasts_time_order",
            "weather_forecasts, published_at, 2026-10-22 23:00:00, chk_weather_forecasts_time_order",
            "weather_forecasts, forecast_at, 2026-10-22 20:01:00, chk_weather_forecasts_hours",
            "weather_forecasts, published_at, 2026-10-22 17:00:01, chk_weather_forecasts_hours",
            "weather_daily_forecasts, tmn_published_at, 2026-10-24 02:00:00, chk_weather_daily_forecasts_tmn_date",
            "weather_daily_forecasts, tmx_published_at, 2026-10-24 02:00:00, chk_weather_daily_forecasts_tmx_date",
            "weather_daily_forecasts, tmn_published_at, 2026-10-22 17:01:00, chk_weather_daily_forecasts_tmn_hour",
            "weather_daily_forecasts, tmx_published_at, 2026-10-22 17:00:01, chk_weather_daily_forecasts_tmx_hour"
    })
    @DisplayName("발표보다 이른 대상 시각·날짜와 시간 단위가 아닌 발표·예보시각을 거부한다")
    void rejectsInvalidTimes(final String table, final String column, final String value, final String constraint) {
        insertForecast(table, 60, 127);

        assertThatThrownBy(() -> jdbcTemplate.update("UPDATE " + table + " SET " + column + " = ?", value))
                .isInstanceOf(DataAccessException.class).hasMessageContaining(constraint);
    }

    @ParameterizedTest
    @ValueSource(strings = {"tmn", "tmx"})
    @DisplayName("일별 기온의 값만 저장하거나 발표·수집시각 중 하나만 저장할 수 없다")
    void rejectsIncompleteDailyMetadata(final String element) {
        insertForecast("weather_daily_forecasts", 60, 127);
        String constraint = "chk_weather_daily_forecasts_" + element + "_metadata";

        assertThatThrownBy(() -> jdbcTemplate.update(
                "UPDATE weather_daily_forecasts SET " + element + "_published_at = NULL"))
                .isInstanceOf(DataAccessException.class).hasMessageContaining(constraint);
        assertThatThrownBy(() -> jdbcTemplate.update(
                "UPDATE weather_daily_forecasts SET " + element + "_collected_at = NULL"))
                .isInstanceOf(DataAccessException.class).hasMessageContaining(constraint);
        assertThatThrownBy(() -> jdbcTemplate.update("UPDATE weather_daily_forecasts SET "
                + element + "_published_at = NULL, " + element + "_collected_at = NULL"))
                .isInstanceOf(DataAccessException.class).hasMessageContaining(constraint);
    }

    @Test
    @DisplayName("어떤 요소도 수집하지 않은 일별 행은 만들 수 없다")
    void rejectsDailyRowWithoutAnySource() {
        assertThatThrownBy(() -> jdbcTemplate.update("""
                INSERT INTO weather_daily_forecasts (grid_x, grid_y, forecast_date) VALUES (60, 127, ?)
                """, FORECAST_DATE))
                .isInstanceOf(DataAccessException.class).hasMessageContaining("chk_weather_daily_forecasts_source");
    }

    private void insertForecast(final String table, final int nx, final int ny) {
        if (table.equals("weather_forecasts")) {
            jdbcTemplate.update("""
                    INSERT INTO weather_forecasts (grid_x, grid_y, forecast_at, published_at, collected_at, tmp)
                    VALUES (?, ?, ?, ?, ?, 0)
                    """, nx, ny, FORECAST_AT, PUBLISHED_AT, COLLECTED_AT);
            return;
        }
        jdbcTemplate.update("""
                INSERT INTO weather_daily_forecasts
                    (grid_x, grid_y, forecast_date, tmn, tmn_published_at, tmn_collected_at,
                     tmx, tmx_published_at, tmx_collected_at)
                VALUES (?, ?, ?, 0, ?, ?, 0, ?, ?)
                """, nx, ny, FORECAST_DATE, PUBLISHED_AT, COLLECTED_AT, PUBLISHED_AT, COLLECTED_AT);
    }

    private static Stream<Arguments> missingSentinelCases() {
        return Stream.of("tmp", "sky", "pty", "pop", "pcp", "sno", "reh", "wsd", "tmn", "tmx")
                .flatMap(column -> Stream.of(-99.0, -999.0)
                        .map(value -> Arguments.of(column.equals("tmn") || column.equals("tmx")
                                ? "weather_daily_forecasts" : "weather_forecasts", column, value)));
    }
}
