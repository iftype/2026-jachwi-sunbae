package com.jachwisunbae.weather.repository;

import static org.assertj.core.api.Assertions.assertThat;

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
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class WeatherForecastRecollectionIntegrationTest {

    private static final Logger log = LoggerFactory.getLogger(WeatherForecastRecollectionIntegrationTest.class);
    private static final int GRID_COUNT = 1001;
    private static final LocalDateTime PUBLISHED_AT = LocalDateTime.of(2026, 10, 22, 17, 0);
    private static final LocalDateTime LATEST_PUBLISHED_AT = PUBLISHED_AT.plusHours(3);
    private static final LocalDateTime COLLECTED_AT = PUBLISHED_AT.plusMinutes(15).plusNanos(123456000);
    private static final LocalDateTime RECOLLECTED_AT = COLLECTED_AT.plusMinutes(10);
    private static final LocalDateTime LATEST_COLLECTED_AT = COLLECTED_AT.plusHours(3);
    private static final LocalDateTime CORRECTED_AT = LATEST_COLLECTED_AT.plusMinutes(10);
    private static final LocalDateTime STALE_COLLECTED_AT = LATEST_COLLECTED_AT.plusHours(1);

    @Container
    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.10");

    private static JdbcTemplate jdbcTemplate;

    private JdbcWeatherForecastRepository repository;
    private TransactionTemplate transaction;
    private boolean rewriteBatches;

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
    }

    @ParameterizedTest(name = "rewriteBatchedStatements={0}")
    @ValueSource(booleans = {false, true})
    @DisplayName("여러 격자·시각의 최초 적재와 재수집 후 시간별 전체 행·값·시각이 일치한다")
    void reconcilesHourlyForecasts(final boolean rewriteBatches) {
        configureRepository(rewriteBatches);
        LocalDateTime first = LocalDateTime.of(2026, 10, 22, 23, 0);
        LocalDateTime second = first.plusHours(1);
        LocalDateTime third = first.plusHours(2);
        List<HourlyForecast> initial = concat(
                hourly(first, PUBLISHED_AT, COLLECTED_AT, 10.0, 1.0, 0.0, 20.0, 0.0, 0.0, 65.0, 0.7),
                hourly(second, PUBLISHED_AT, COLLECTED_AT, -7.0, 3.0, 0.0, 30.0, 0.0, null, 80.0, 1.2));
        assertThat(readHourly()).isEmpty();
        verifyHourly("initial", initial, initial, new Changes(2002, 0, 0));
        verifyHourly("replay", initial, initial, new Changes(0, 0, 2002));

        List<HourlyForecast> recollectedFirst = hourly(first, PUBLISHED_AT, RECOLLECTED_AT,
                10.0, 1.0, 0.0, 20.0, 0.0, 0.0, 65.0, 0.7);
        List<HourlyForecast> recollectedSecond = hourly(second, PUBLISHED_AT, RECOLLECTED_AT,
                -7.0, 3.0, 0.0, 30.0, 0.0, null, 80.0, 1.2);
        List<HourlyForecast> recollected = concat(recollectedFirst, recollectedSecond);
        verifyHourly("recollect", recollected, recollected, new Changes(0, 2002, 0));

        List<HourlyForecast> latestFirst = hourly(first, LATEST_PUBLISHED_AT, LATEST_COLLECTED_AT,
                0.0, 4.0, 1.0, 60.0, null, 0.0, 90.0, 4.2);
        List<HourlyForecast> latestThird = hourly(third, LATEST_PUBLISHED_AT, LATEST_COLLECTED_AT,
                -6.5, 3.0, 2.0, 70.0, null, null, 95.0, 3.1);
        verifyHourly("new-publication", concat(latestFirst, latestThird),
                concat(latestFirst, recollectedSecond, latestThird), new Changes(1001, 1001, 1001));

        List<HourlyForecast> correctedFirst = hourly(first, LATEST_PUBLISHED_AT, CORRECTED_AT,
                null, 1.0, 0.0, 0.0, 0.0, null, null, 0.0);
        List<HourlyForecast> staleThird = hourly(third, PUBLISHED_AT, STALE_COLLECTED_AT,
                20.0, 4.0, 4.0, 80.0, 0.0, 0.0, 100.0, 12.4);
        List<HourlyForecast> corrected = concat(correctedFirst, recollectedSecond, latestThird);
        verifyHourly("correction-and-stale", concat(correctedFirst, staleThird), corrected,
                new Changes(0, 1001, 2002));

        List<HourlyForecast> stale = List.of(first, second, third).stream()
                .flatMap(target -> hourly(target, PUBLISHED_AT.minusHours(3), STALE_COLLECTED_AT,
                        20.0, 4.0, 4.0, 80.0, 0.0, 0.0, 100.0, 12.4).stream())
                .toList();
        verifyHourly("stale", stale, corrected, new Changes(0, 0, 3003));

        List<HourlyForecast> zeroFirst = hourly(first, LATEST_PUBLISHED_AT, STALE_COLLECTED_AT.plusMinutes(1),
                0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
        verifyHourly("zero-correction", zeroFirst, concat(zeroFirst, recollectedSecond, latestThird),
                new Changes(0, 1001, 2002));
    }

    @ParameterizedTest(name = "rewriteBatchedStatements={0}")
    @ValueSource(booleans = {false, true})
    @DisplayName("여러 격자·날짜의 재수집에서 일별 요소의 최신성·미수집·결측·0을 보존한다")
    void reconcilesDailyForecasts(final boolean rewriteBatches) {
        configureRepository(rewriteBatches);
        LocalDate first = PUBLISHED_AT.toLocalDate();
        LocalDate second = first.plusDays(1);
        LocalDate third = first.plusDays(2);
        DailyTemperature minimum = temperature(7.0, PUBLISHED_AT, COLLECTED_AT);
        DailyTemperature maximum = temperature(21.0, PUBLISHED_AT, COLLECTED_AT);
        List<DailyForecast> initial = concat(daily(first, minimum, maximum), daily(second, minimum, maximum));
        assertThat(readDaily()).isEmpty();
        verifyDaily("initial", initial, initial, new Changes(2002, 0, 0));
        verifyDaily("replay", initial, initial, new Changes(0, 0, 2002));

        DailyTemperature recollectedMinimum = temperature(7.0, PUBLISHED_AT, RECOLLECTED_AT);
        DailyTemperature recollectedMaximum = temperature(21.0, PUBLISHED_AT, RECOLLECTED_AT);
        List<DailyForecast> recollectedFirst = daily(first, recollectedMinimum, recollectedMaximum);
        List<DailyForecast> recollectedSecond = daily(second, recollectedMinimum, recollectedMaximum);
        List<DailyForecast> recollected = concat(recollectedFirst, recollectedSecond);
        verifyDaily("recollect", recollected, recollected, new Changes(0, 2002, 0));

        DailyTemperature latestMinimum = temperature(-6.5, LATEST_PUBLISHED_AT, LATEST_COLLECTED_AT);
        List<DailyForecast> latestFirst = daily(first, latestMinimum, recollectedMaximum);
        List<DailyForecast> latestThird = daily(third, latestMinimum, null);
        verifyDaily("new-publication", concat(daily(first, latestMinimum, null), latestThird),
                concat(latestFirst, recollectedSecond, latestThird), new Changes(1001, 1001, 1001));

        DailyTemperature staleMinimum = temperature(99.0, PUBLISHED_AT, STALE_COLLECTED_AT);
        DailyTemperature missingMaximum = temperature(null, LATEST_PUBLISHED_AT, CORRECTED_AT);
        DailyTemperature laterArrivingMaximum = temperature(21.0, PUBLISHED_AT, STALE_COLLECTED_AT);
        List<DailyForecast> correctedFirst = daily(first, latestMinimum, missingMaximum);
        List<DailyForecast> filledThird = daily(third, latestMinimum, laterArrivingMaximum);
        List<DailyForecast> corrected = concat(correctedFirst, recollectedSecond, filledThird);
        verifyDaily("correction-and-fill", concat(daily(first, staleMinimum, missingMaximum),
                        daily(third, null, laterArrivingMaximum)), corrected, new Changes(0, 2002, 1001));

        DailyTemperature staleValue = temperature(99.0, PUBLISHED_AT.minusHours(3), STALE_COLLECTED_AT);
        List<DailyForecast> stale = concat(daily(first, staleValue, staleValue),
                daily(second, staleValue, staleValue), daily(third, staleValue, staleValue));
        verifyDaily("stale", stale, corrected, new Changes(0, 0, 3003));

        DailyTemperature missingMinimum = temperature(null, LATEST_PUBLISHED_AT, STALE_COLLECTED_AT.plusMinutes(1));
        DailyTemperature zeroMaximum = temperature(0.0, LATEST_PUBLISHED_AT, STALE_COLLECTED_AT.plusMinutes(1));
        List<DailyForecast> zeroFirst = daily(first, missingMinimum, zeroMaximum);
        verifyDaily("zero-correction", zeroFirst, concat(zeroFirst, recollectedSecond, filledThird),
                new Changes(0, 1001, 2002));
    }

    private static DataSource dataSource(final boolean rewriteBatches) {
        String url = MYSQL.getJdbcUrl();
        return new DriverManagerDataSource(url + (url.contains("?") ? "&" : "?")
                + "connectionTimeZone=%2B00:00&forceConnectionTimeZoneToSession=true&rewriteBatchedStatements="
                + rewriteBatches, MYSQL.getUsername(), MYSQL.getPassword());
    }

    private void configureRepository(final boolean rewriteBatches) {
        DataSource dataSource = dataSource(rewriteBatches);
        repository = new JdbcWeatherForecastRepository(new JdbcTemplate(dataSource));
        transaction = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        this.rewriteBatches = rewriteBatches;
    }

    private List<HourlyForecast> hourly(final LocalDateTime target, final LocalDateTime publishedAt,
                                       final LocalDateTime collectedAt, final Double... values) {
        assertThat(values).hasSize(8);
        return IntStream.range(0, GRID_COUNT)
                .mapToObj(index -> new HourlyForecast(GridPoint.fromIndex(index), new ForecastTimes(publishedAt, target),
                        values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7],
                        collectedAt.plusNanos(index * 1000L)))
                .toList();
    }

    private List<DailyForecast> daily(final LocalDate target, final DailyTemperature minimum,
                                     final DailyTemperature maximum) {
        return IntStream.range(0, GRID_COUNT)
                .mapToObj(index -> new DailyForecast(GridPoint.fromIndex(index), target,
                        withGridCollectionTime(minimum, index), withGridCollectionTime(maximum, index)))
                .toList();
    }

    // 격자마다 마이크로초를 달리해 행 수뿐 아니라 각 좌표의 출처 시각까지 대조한다.
    private DailyTemperature withGridCollectionTime(final DailyTemperature source, final int index) {
        if (source == null) {
            return null;
        }
        return temperature(source.value(), source.publishedAt(), source.collectedAt().plusNanos(index * 1000L));
    }

    private DailyTemperature temperature(final Double value, final LocalDateTime publishedAt,
                                         final LocalDateTime collectedAt) {
        return new DailyTemperature(value, publishedAt, collectedAt);
    }

    @SafeVarargs
    private static <T> List<T> concat(final List<T>... groups) {
        return Arrays.stream(groups).flatMap(List::stream).toList();
    }

    private void verifyHourly(final String phase, final List<HourlyForecast> input,
                              final List<HourlyForecast> expected, final Changes changes) {
        verifyStage("hourly", phase, input, expected, changes, repository::upsertHourly, this::readHourly,
                row -> List.of(row.point(), row.times().forecastAt()));
    }

    private void verifyDaily(final String phase, final List<DailyForecast> input,
                             final List<DailyForecast> expected, final Changes changes) {
        verifyStage("daily", phase, input, expected, changes, repository::upsertDaily, this::readDaily,
                row -> List.of(row.point(), row.forecastDate()));
    }

    private <T> void verifyStage(final String table, final String phase, final List<T> input, final List<T> expected,
                                 final Changes expectedChanges, final Consumer<List<T>> save,
                                 final Supplier<List<T>> read, final Function<T, List<?>> key) {
        Map<List<?>, T> before = read.get().stream().collect(Collectors.toMap(key, Function.identity()));
        long start = System.nanoTime();
        transaction.executeWithoutResult(status -> save.accept(input));
        long elapsedNanos = System.nanoTime() - start;
        List<T> stored = read.get();

        // 기대 결과를 발표시각 비교 로직으로 계산하지 않고 단계별로 명시한 전체 행과 대조한다.
        assertThat(stored).as("%s/%s 전체 행과 출처 시각", table, phase)
                .containsExactlyInAnyOrderElementsOf(expected);
        Map<List<?>, T> after = stored.stream().collect(Collectors.toMap(key, Function.identity()));
        assertThat(after.keySet()).containsAll(before.keySet());
        long inserted = after.keySet().stream().filter(rowKey -> !before.containsKey(rowKey)).count();
        long updated = before.entrySet().stream()
                .filter(entry -> !entry.getValue().equals(after.get(entry.getKey()))).count();
        Changes actualChanges = new Changes(inserted, updated, before.size() - updated);
        assertThat(actualChanges).as("%s/%s 실제 저장 결과의 변화", table, phase).isEqualTo(expectedChanges);

        log.info("weather-storage-check table={} phase={} rewrite={} input={} expected={} actual={} "
                        + "inserted={} updated={} unchanged={} dbMicros={}",
                table, phase, rewriteBatches, input.size(), expected.size(), stored.size(),
                inserted, updated, actualChanges.unchanged(), elapsedNanos / 1000);
    }

    private List<HourlyForecast> readHourly() {
        return jdbcTemplate.query("SELECT * FROM weather_forecasts", (rs, index) -> new HourlyForecast(
                new GridPoint(rs.getInt("grid_x"), rs.getInt("grid_y")),
                new ForecastTimes(rs.getObject("published_at", LocalDateTime.class),
                        rs.getObject("forecast_at", LocalDateTime.class)),
                rs.getObject("tmp", Double.class), rs.getObject("sky", Double.class),
                rs.getObject("pty", Double.class), rs.getObject("pop", Double.class),
                rs.getObject("pcp", Double.class), rs.getObject("sno", Double.class),
                rs.getObject("reh", Double.class), rs.getObject("wsd", Double.class),
                rs.getObject("collected_at", LocalDateTime.class)));
    }

    private List<DailyForecast> readDaily() {
        return jdbcTemplate.query("SELECT * FROM weather_daily_forecasts", (rs, index) -> new DailyForecast(
                new GridPoint(rs.getInt("grid_x"), rs.getInt("grid_y")), rs.getObject("forecast_date", LocalDate.class),
                readTemperature(rs, "tmn"), readTemperature(rs, "tmx")));
    }

    private DailyTemperature readTemperature(final ResultSet rs, final String column) throws SQLException {
        LocalDateTime publishedAt = rs.getObject(column + "_published_at", LocalDateTime.class);
        if (publishedAt == null) {
            return null;
        }
        return temperature(rs.getObject(column, Double.class), publishedAt,
                rs.getObject(column + "_collected_at", LocalDateTime.class));
    }

    private record Changes(long inserted, long updated, long unchanged) {
    }
}
