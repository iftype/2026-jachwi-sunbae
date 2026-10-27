package com.jachwisunbae.weather.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.weather.domain.DailyForecast;
import com.jachwisunbae.weather.domain.DailyTemperature;
import com.jachwisunbae.weather.domain.ForecastTimes;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.HourlyForecast;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.stream.IntStream;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class JdbcWeatherForecastRepositoryTest {

    private static final GridPoint POINT = new GridPoint(60, 127);
    private static final LocalDateTime FORECAST_AT = LocalDateTime.of(2026, 10, 23, 0, 0);
    private static final LocalDate DATE = FORECAST_AT.toLocalDate();
    private static final LocalDateTime PUBLISHED_AT = LocalDateTime.of(2026, 10, 22, 17, 0);
    private static final LocalDateTime COLLECTED_AT = PUBLISHED_AT.plusMinutes(15).plusNanos(123456000);

    @Container
    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.10");

    private static JdbcTemplate jdbcTemplate;

    @BeforeAll
    static void setUpSchema() {
        DataSource dataSource = dataSource(false);
        Flyway.configure().dataSource(dataSource).load().migrate();
        jdbcTemplate = new JdbcTemplate(dataSource);
    }

    @BeforeEach
    void clearForecasts() {
        jdbcTemplate.update("DELETE FROM weather_forecasts");
        jdbcTemplate.update("DELETE FROM weather_daily_forecasts");
        jdbcTemplate.update("DELETE FROM weather_collection_publications");
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    @DisplayName("시간별 예보를 삽입하고 동일 발표분의 8개 값·결측·수집시각 정정을 반영한다")
    void upsertsHourlyCorrections(final boolean rewriteBatches) {
        JdbcWeatherForecastRepository repository = repository(rewriteBatches);
        HourlyForecast first = hourly(POINT, PUBLISHED_AT, COLLECTED_AT, 10.0);
        repository.upsertHourly(List.of(first));
        assertHourly(first);

        HourlyForecast correction = new HourlyForecast(POINT, first.times(), -7.25, 4.0, 3.0, 70.0,
                null, 0.0, 90.0, 2.3, COLLECTED_AT.plusMinutes(10));
        repository.upsertHourly(List.of(correction));

        assertHourly(correction);
        assertThat(count("weather_forecasts")).isOne();
        repository.upsertHourly(List.of(correction));
        assertHourly(correction);
        assertThat(count("weather_forecasts")).isOne();
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    @DisplayName("같은 배치에서 최신 발표분 뒤에 과거 발표분이 도착해도 값과 수집시각을 유지한다")
    void keepsNewestHourlyPublication(final boolean rewriteBatches) {
        JdbcWeatherForecastRepository repository = repository(rewriteBatches);
        repository.upsertHourly(List.of(hourly(POINT, PUBLISHED_AT, COLLECTED_AT, 10.0)));
        HourlyForecast latest = new HourlyForecast(POINT, new ForecastTimes(PUBLISHED_AT.plusHours(3), FORECAST_AT),
                0.0, 3.0, 1.0, 60.0, 1.5, null, 80.0, 4.2, COLLECTED_AT.plusHours(3));
        HourlyForecast oldButCollectedLater = hourly(POINT, PUBLISHED_AT, COLLECTED_AT.plusHours(4), 99.0);

        repository.upsertHourly(List.of(latest, oldButCollectedLater));

        assertHourly(latest);
        assertThat(count("weather_forecasts")).isOne();
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    @DisplayName("시간별 정상 결측으로 기존 값을 지우고 같은 발표분의 0을 다시 반영할 수 있다")
    void replacesHourlyValuesWithNullAndZero(final boolean rewriteBatches) {
        JdbcWeatherForecastRepository repository = repository(rewriteBatches);
        repository.upsertHourly(List.of(hourly(POINT, PUBLISHED_AT, COLLECTED_AT, 10.0)));
        HourlyForecast missing = new HourlyForecast(POINT, new ForecastTimes(PUBLISHED_AT, FORECAST_AT),
                null, null, null, null, null, null, null, null, COLLECTED_AT.plusMinutes(1));
        repository.upsertHourly(List.of(missing));
        assertHourly(missing);

        HourlyForecast zero = hourly(POINT, PUBLISHED_AT, COLLECTED_AT.plusMinutes(2), 0.0);
        repository.upsertHourly(List.of(zero));

        assertHourly(zero);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    @DisplayName("서로 다른 시각의 TMN·TMX를 같은 날짜의 한 행에 모으고 미수집 요소는 덮어쓰지 않는다")
    void combinesDailyElementsWithoutErasingUncollectedValues(final boolean rewriteBatches) {
        JdbcWeatherForecastRepository repository = repository(rewriteBatches);
        DailyTemperature minimum = temperature(-6.5, PUBLISHED_AT.plusHours(3), COLLECTED_AT.plusHours(3));
        DailyTemperature maximum = temperature(21.0, PUBLISHED_AT, COLLECTED_AT);

        repository.upsertDaily(List.of(new DailyForecast(POINT, DATE, minimum, null),
                new DailyForecast(POINT, DATE, null, maximum)));

        DailyForecast expected = new DailyForecast(POINT, DATE, minimum, maximum);
        assertDaily(expected);
        repository.upsertDaily(List.of(new DailyForecast(POINT, DATE, minimum, null)));
        assertDaily(expected);
        assertThat(count("weather_daily_forecasts")).isOne();
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    @DisplayName("일별 최신성을 요소마다 비교해 한 행에서 새 TMN은 반영하고 과거 TMX는 무시한다")
    void comparesDailyPublicationPerElement(final boolean rewriteBatches) {
        JdbcWeatherForecastRepository repository = repository(rewriteBatches);
        DailyTemperature oldMinimum = temperature(-6.0, PUBLISHED_AT, COLLECTED_AT);
        DailyTemperature latestMaximum = temperature(21.0, PUBLISHED_AT.plusHours(3), COLLECTED_AT.plusHours(3));
        repository.upsertDaily(List.of(new DailyForecast(POINT, DATE, oldMinimum, latestMaximum)));
        DailyTemperature latestMinimum = temperature(null, PUBLISHED_AT.plusHours(3), COLLECTED_AT.plusHours(4));
        DailyTemperature staleMaximum = temperature(99.0, PUBLISHED_AT, COLLECTED_AT.plusHours(4));

        repository.upsertDaily(List.of(new DailyForecast(POINT, DATE, latestMinimum, staleMaximum)));

        assertDaily(new DailyForecast(POINT, DATE, latestMinimum, latestMaximum));
        DailyTemperature newerMaximum = temperature(24.0, PUBLISHED_AT.plusHours(6), COLLECTED_AT.plusHours(6));
        repository.upsertDaily(List.of(new DailyForecast(POINT, DATE, oldMinimum, newerMaximum)));
        assertDaily(new DailyForecast(POINT, DATE, latestMinimum, newerMaximum));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    @DisplayName("일별 동일 발표분의 결측·0 정정과 재수집 시각을 반영한다")
    void correctsDailyNullAndZero(final boolean rewriteBatches) {
        JdbcWeatherForecastRepository repository = repository(rewriteBatches);
        repository.upsertDaily(List.of(new DailyForecast(POINT, DATE,
                temperature(-6.0, PUBLISHED_AT, COLLECTED_AT), temperature(21.0, PUBLISHED_AT, COLLECTED_AT))));
        DailyForecast missing = new DailyForecast(POINT, DATE,
                temperature(null, PUBLISHED_AT, COLLECTED_AT.plusMinutes(1)),
                temperature(null, PUBLISHED_AT, COLLECTED_AT.plusMinutes(1)));

        repository.upsertDaily(List.of(missing));
        assertDaily(missing);
        DailyForecast zero = new DailyForecast(POINT, DATE,
                temperature(0.0, PUBLISHED_AT, COLLECTED_AT.plusMinutes(2)),
                temperature(0.0, PUBLISHED_AT, COLLECTED_AT.plusMinutes(2)));
        repository.upsertDaily(List.of(zero, zero));

        assertDaily(zero);
        assertThat(count("weather_daily_forecasts")).isOne();
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    @DisplayName("1000행 배치 경계를 넘어 두 테이블에 빠짐없이 저장하고 재실행해도 중복되지 않는다")
    void savesAcrossBatchBoundary(final boolean rewriteBatches) {
        DataSource dataSource = dataSource(rewriteBatches);
        JdbcWeatherForecastRepository repository = new JdbcWeatherForecastRepository(new JdbcTemplate(dataSource));
        List<HourlyForecast> hourly = IntStream.range(0, 1001)
                .mapToObj(index -> hourly(GridPoint.fromIndex(index), PUBLISHED_AT, COLLECTED_AT, (double) index))
                .toList();
        List<DailyForecast> daily = IntStream.range(0, 1001)
                .mapToObj(index -> new DailyForecast(GridPoint.fromIndex(index), DATE,
                        temperature((double) index, PUBLISHED_AT, COLLECTED_AT), null))
                .toList();

        new TransactionTemplate(new DataSourceTransactionManager(dataSource)).executeWithoutResult(status -> {
            repository.upsertHourly(hourly);
            repository.upsertDaily(daily);
            repository.upsertHourly(hourly);
            repository.upsertDaily(daily);
        });

        assertThat(count("weather_forecasts")).isEqualTo(1001);
        assertThat(count("weather_daily_forecasts")).isEqualTo(1001);
        assertHourly(hourly.getFirst());
        assertHourly(hourly.getLast());
        assertDaily(daily.getFirst());
        assertDaily(daily.getLast());
    }

    @Test
    @DisplayName("기준 시각·날짜 이전의 예보만 삭제하고 기준 이후는 보존한다")
    void deletesOnlyForecastsBeforeCutoff() {
        JdbcWeatherForecastRepository repository = repository(true);
        repository.upsertHourly(List.of(
                new HourlyForecast(POINT, new ForecastTimes(PUBLISHED_AT, FORECAST_AT.minusHours(1)),
                        1.0, 1.0, 0.0, 0.0, 0.0, null, 50.0, 1.0, COLLECTED_AT),
                hourly(POINT, PUBLISHED_AT, COLLECTED_AT, 1.0)));
        repository.upsertDaily(List.of(
                new DailyForecast(POINT, DATE.minusDays(1), temperature(1.0, PUBLISHED_AT, COLLECTED_AT), null),
                new DailyForecast(POINT, DATE, temperature(1.0, PUBLISHED_AT, COLLECTED_AT), null)));

        assertThat(repository.deleteHourlyBefore(FORECAST_AT)).isOne();
        assertThat(repository.deleteDailyBefore(DATE)).isOne();

        assertHourly(hourly(POINT, PUBLISHED_AT, COLLECTED_AT, 1.0));
        assertThat(count("weather_forecasts")).isOne();
        assertThat(count("weather_daily_forecasts")).isOne();
    }

    @Test
    @DisplayName("저장소는 호출자가 연 트랜잭션에 참여해 두 테이블을 함께 롤백한다")
    void participatesInCallerTransaction() {
        DataSource dataSource = dataSource(false);
        JdbcWeatherForecastRepository repository = new JdbcWeatherForecastRepository(new JdbcTemplate(dataSource));
        TransactionTemplate transaction = new TransactionTemplate(new DataSourceTransactionManager(dataSource));

        assertThatThrownBy(() -> transaction.executeWithoutResult(status -> {
            repository.upsertHourly(List.of(hourly(POINT, PUBLISHED_AT, COLLECTED_AT, 10.0)));
            repository.upsertDaily(List.of(new DailyForecast(POINT, DATE,
                    temperature(-6.0, PUBLISHED_AT, COLLECTED_AT), null)));
            throw new IllegalStateException("수집 작업 실패");
        })).isInstanceOf(IllegalStateException.class).hasMessage("수집 작업 실패");

        assertThat(count("weather_forecasts")).isZero();
        assertThat(count("weather_daily_forecasts")).isZero();
    }

    @Test
    @DisplayName("빈 목록은 아무것도 저장하지 않고 null 행이 든 목록은 쓰기 전에 거부한다")
    void handlesEmptyListsAndRejectsNullRowsBeforeWriting() {
        JdbcWeatherForecastRepository repository = repository(false);
        repository.upsertHourly(List.of());
        repository.upsertDaily(List.of());

        assertThatThrownBy(() -> repository.upsertHourly(Arrays.asList(
                hourly(POINT, PUBLISHED_AT, COLLECTED_AT, 10.0), null))).isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> repository.upsertDaily(Arrays.asList(
                new DailyForecast(POINT, DATE, temperature(1.0, PUBLISHED_AT, COLLECTED_AT), null), null)))
                .isInstanceOf(NullPointerException.class);
        assertThat(count("weather_forecasts")).isZero();
        assertThat(count("weather_daily_forecasts")).isZero();
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    @DisplayName("한 시각·날짜의 두 번째 JDBC 배치가 실패하면 첫 배치도 롤백한다")
    void annotationTransactionRollsBackEveryBatch(final boolean daily) {
        DataSource source = dataSource(false);
        JdbcTemplate jdbc = new JdbcTemplate(source);
        var target = com.jachwisunbae.weather.support.WeatherTransactionTestSupport.transactional(
                new JdbcWeatherForecastRepository(jdbc), source);
        String table = daily ? "weather_daily_forecasts" : "weather_forecasts";
        jdbc.execute("ALTER TABLE " + table + " ADD CONSTRAINT fail_weather_batch CHECK (NOT (grid_x = 107 AND grid_y = 7))");
        try {
            assertThatThrownBy(() -> {
                if (daily) {
                    target.upsertDaily(IntStream.range(0, 1001).mapToObj(index -> new DailyForecast(
                            new GridPoint(index % 149 + 1, index / 149 + 1), DATE,
                            temperature(1.0, PUBLISHED_AT, COLLECTED_AT), null)).toList());
                } else {
                    target.upsertHourly(IntStream.range(0, 1001).mapToObj(index -> hourly(
                            new GridPoint(index % 149 + 1, index / 149 + 1), PUBLISHED_AT, COLLECTED_AT, 1.0)).toList());
                }
            }).isInstanceOf(org.springframework.dao.DataAccessException.class);
            assertThat(count(table)).isZero();
        } finally {
            jdbc.execute("ALTER TABLE " + table + " DROP CHECK fail_weather_batch");
        }
    }

    private static DataSource dataSource(final boolean rewriteBatches) {
        String url = MYSQL.getJdbcUrl();
        // DB 세션이 UTC여도 KST LocalDateTime과 DATE를 변환 없이 저장해야 한다.
        return new DriverManagerDataSource(url + (url.contains("?") ? "&" : "?")
                + "connectionTimeZone=%2B00:00&forceConnectionTimeZoneToSession=true&rewriteBatchedStatements="
                + rewriteBatches, MYSQL.getUsername(), MYSQL.getPassword());
    }

    private JdbcWeatherForecastRepository repository(final boolean rewriteBatches) {
        return new JdbcWeatherForecastRepository(new JdbcTemplate(dataSource(rewriteBatches)));
    }

    private HourlyForecast hourly(final GridPoint point, final LocalDateTime publishedAt,
                                  final LocalDateTime collectedAt, final Double tmp) {
        return new HourlyForecast(point, new ForecastTimes(publishedAt, FORECAST_AT),
                tmp, 1.0, 0.0, 30.0, 0.0, null, 65.0, 0.7, collectedAt);
    }

    private DailyTemperature temperature(final Double value, final LocalDateTime publishedAt,
                                         final LocalDateTime collectedAt) {
        return new DailyTemperature(value, publishedAt, collectedAt);
    }

    private int count(final String table) {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
    }

    private void assertHourly(final HourlyForecast expected) {
        HourlyForecast stored = jdbcTemplate.queryForObject("""
                SELECT * FROM weather_forecasts WHERE grid_x = ? AND grid_y = ? AND forecast_at = ?
                """, (rs, index) -> new HourlyForecast(new GridPoint(rs.getInt("grid_x"), rs.getInt("grid_y")),
                new ForecastTimes(rs.getObject("published_at", LocalDateTime.class),
                        rs.getObject("forecast_at", LocalDateTime.class)),
                rs.getObject("tmp", Double.class), rs.getObject("sky", Double.class),
                rs.getObject("pty", Double.class), rs.getObject("pop", Double.class),
                rs.getObject("pcp", Double.class), rs.getObject("sno", Double.class),
                rs.getObject("reh", Double.class), rs.getObject("wsd", Double.class),
                rs.getObject("collected_at", LocalDateTime.class)),
                expected.point().nx(), expected.point().ny(), expected.times().forecastAt());
        assertThat(stored).isEqualTo(expected);
    }

    private void assertDaily(final DailyForecast expected) {
        DailyForecast stored = jdbcTemplate.queryForObject("""
                SELECT * FROM weather_daily_forecasts WHERE grid_x = ? AND grid_y = ? AND forecast_date = ?
                """, (rs, index) -> new DailyForecast(new GridPoint(rs.getInt("grid_x"), rs.getInt("grid_y")),
                rs.getObject("forecast_date", LocalDate.class), readTemperature(rs, "tmn"), readTemperature(rs, "tmx")),
                expected.point().nx(), expected.point().ny(), expected.forecastDate());
        assertThat(stored).isEqualTo(expected);
    }

    private DailyTemperature readTemperature(final ResultSet rs, final String column) throws SQLException {
        LocalDateTime publishedAt = rs.getObject(column + "_published_at", LocalDateTime.class);
        if (publishedAt == null) {
            return null;
        }
        return temperature(rs.getObject(column, Double.class), publishedAt,
                rs.getObject(column + "_collected_at", LocalDateTime.class));
    }
}
