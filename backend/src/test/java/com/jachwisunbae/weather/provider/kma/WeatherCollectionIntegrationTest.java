package com.jachwisunbae.weather.provider.kma;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.jachwisunbae.weather.domain.ForecastTimes;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.WeatherElement;
import com.jachwisunbae.weather.repository.JdbcWeatherForecastRepository;
import com.jachwisunbae.weather.service.WeatherCollectionService;
import com.jachwisunbae.weather.service.collection.WeatherCollectionPlan;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.mock.http.client.MockClientHttpResponse;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.client.RestClient;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class WeatherCollectionIntegrationTest {

    private static final int VALID_POINTS = 1001;
    private static final Instant COLLECTED_INSTANT = Instant.parse("2026-10-23T14:30:00.123456789Z");
    // MySQL DATETIME(6)은 나노초 입력을 마이크로초로 반올림한다.
    private static final LocalDateTime COLLECTED_AT = LocalDateTime.ofInstant(COLLECTED_INSTANT, ZoneId.of("Asia/Seoul"))
            .plusNanos(500).truncatedTo(ChronoUnit.MICROS);
    @Container
    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.10");
    private static DriverManagerDataSource dataSource;
    private static JdbcTemplate jdbc;

    @BeforeAll
    static void schema() {
        String url = MYSQL.getJdbcUrl();
        dataSource = new DriverManagerDataSource(url + (url.contains("?") ? "&" : "?")
                + "connectionTimeZone=%2B00:00&forceConnectionTimeZoneToSession=true&rewriteBatchedStatements=true",
                MYSQL.getUsername(), MYSQL.getPassword());
        jdbc = new JdbcTemplate(dataSource);
        Flyway.configure().dataSource(dataSource).load().migrate();
    }

    @BeforeEach
    void clear() {
        jdbc.update("DELETE FROM weather_forecasts");
        jdbc.update("DELETE FROM weather_daily_forecasts");
        jdbc.update("DELETE FROM weather_collection_publications");
    }

    @Test
    @DisplayName("전국 크기의 RAW를 48시간·일별 계획대로 요청하고 원본의 모든 값·시각을 MySQL과 대조한다")
    void collectsAndVerifiesFullPlan() {
        WeatherCollectionPlan plan = WeatherCollectionPlan.forPublication(LocalDate.of(2026, 10, 23).atTime(2, 0));
        Map<KmaForecastRequest, byte[]> raw = new LinkedHashMap<>();
        RestClient.Builder builder = RestClient.builder().baseUrl("https://apihub.kma.go.kr");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        for (KmaForecastRequest request : java.util.stream.Stream.concat(plan.hourlyRequests().stream(), plan.dailyRequests().stream()).toList()) {
            byte[] body = raw(request).getBytes(StandardCharsets.UTF_8);
            raw.put(request, body);
            server.expect(queryParam("tmfc", request.tmfc()))
                    .andExpect(queryParam("tmef", request.tmef()))
                    .andExpect(queryParam("vars", request.element().name()))
                    .andRespond(httpRequest -> {
                        assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
                        return new MockClientHttpResponse(body, HttpStatus.OK);
                    });
        }
        WeatherCollectionService service = service(new KmaForecastClient(builder.build(), "test-key"));

        service.collect(plan.hourlyRequests().getFirst().times().publishedAt());

        server.verify();
        assertThat(count("weather_forecasts")).isEqualTo(48L * VALID_POINTS);
        verifyAgainstRaw(plan, raw, COLLECTED_AT);
        assertThat(jdbc.queryForObject("SELECT completed_at FROM weather_collection_publications WHERE published_at = ?",
                LocalDateTime.class, plan.hourlyRequests().getFirst().times().publishedAt())).isEqualTo(COLLECTED_AT);
    }

    @Test
    @DisplayName("두 번째 예보시각의 HTTP 오류는 첫 시각의 커밋을 보존하고 다음 요청·일별 저장을 중단한다")
    void retainsCompletedHourOnHttpFailure() {
        WeatherCollectionPlan plan = WeatherCollectionPlan.forPublication(LocalDate.of(2026, 10, 23).atTime(2, 0));
        RestClient.Builder builder = RestClient.builder().baseUrl("https://apihub.kma.go.kr");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        for (KmaForecastRequest request : plan.hourlyRequests().subList(0, 8)) {
            server.expect(queryParam("vars", request.element().name())).andRespond(withSuccess(raw(request), MediaType.TEXT_PLAIN));
        }
        server.expect(queryParam("tmef", "2026102304")).andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));

        assertThatThrownBy(() -> service(new KmaForecastClient(builder.build(), "test-key")).collect(plan.hourlyRequests().getFirst().times().publishedAt()))
                .isInstanceOf(com.jachwisunbae.common.exception.server.UpstreamServiceException.class);

        server.verify();
        assertThat(count("weather_forecasts")).isEqualTo(VALID_POINTS);
        assertThat(count("weather_daily_forecasts")).isZero();
        assertThat(jdbc.queryForObject("SELECT MAX(forecast_at) FROM weather_forecasts", LocalDateTime.class))
                .isEqualTo(plan.hourlyRequests().getFirst().times().publishedAt().plusHours(1));
        assertThat(jdbc.queryForObject("SELECT completed_at FROM weather_collection_publications WHERE published_at = ?",
                LocalDateTime.class, plan.hourlyRequests().getFirst().times().publishedAt())).isNull();
    }

    private WeatherCollectionService service(final KmaForecastClient client) {
        return new WeatherCollectionService(client, com.jachwisunbae.weather.support.WeatherTransactionTestSupport.transactional(new JdbcWeatherForecastRepository(jdbc), dataSource),
                Clock.fixed(COLLECTED_INSTANT, ZoneOffset.UTC));
    }

    // 검증은 운영 파서·결합기를 재사용하지 않고 수신 토큰과 DB를 직접 비교한다.
    private void verifyAgainstRaw(final WeatherCollectionPlan plan, final Map<KmaForecastRequest, byte[]> raw,
                                  final LocalDateTime collectedAt) {
        Map<LocalDate, Set<Integer>> dailyPoints = new HashMap<>();
        long hourlyCount = 0;
        for (int hour = 1; hour <= 48; hour++) {
            ForecastTimes times = new ForecastTimes(plan.hourlyRequests().getFirst().times().publishedAt(), plan.hourlyRequests().getFirst().times().publishedAt().plusHours(hour));
            Map<WeatherElement, double[]> elements = new EnumMap<>(WeatherElement.class);
            WeatherElement.hourlyElements().forEach(element -> elements.put(element, tokens(raw.get(new KmaForecastRequest(times, element)))));
            Set<Integer> points = validIndices(elements.get(WeatherElement.TMP));
            dailyPoints.computeIfAbsent(times.forecastAt().toLocalDate(), ignored -> new HashSet<>()).addAll(points);
            List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM weather_forecasts WHERE forecast_at = ?", times.forecastAt());
            assertThat(rows).hasSize(points.size());
            hourlyCount += rows.size();
            for (Map<String, Object> row : rows) {
                int index = index(row);
                assertThat(points).contains(index);
                assertTime(row, "published_at", plan.hourlyRequests().getFirst().times().publishedAt());
                assertTime(row, "forecast_at", times.forecastAt());
                assertTime(row, "collected_at", collectedAt);
                elements.forEach((element, values) -> assertThat(row.get(element.name().toLowerCase(java.util.Locale.ROOT)))
                        .isEqualTo(nullable(values[index])));
            }
        }
        assertThat(count("weather_forecasts")).isEqualTo(hourlyCount);
        long dailyCount = 0;
        for (var entry : dailyPoints.entrySet()) {
            Map<WeatherElement, double[]> elements = new EnumMap<>(WeatherElement.class);
            plan.dailyRequests().stream().filter(request -> request.times().forecastAt().toLocalDate().equals(entry.getKey()))
                    .forEach(request -> elements.put(request.element(), tokens(raw.get(request))));
            List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM weather_daily_forecasts WHERE forecast_date = ?", entry.getKey());
            assertThat(rows).hasSize(elements.isEmpty() ? 0 : entry.getValue().size());
            dailyCount += rows.size();
            for (Map<String, Object> row : rows) {
                int index = index(row);
                assertThat(entry.getValue()).contains(index);
                for (WeatherElement element : List.of(WeatherElement.TMN, WeatherElement.TMX)) {
                    String column = element.name().toLowerCase(java.util.Locale.ROOT);
                    double[] values = elements.get(element);
                    assertThat(row.get(column)).isEqualTo(values == null ? null : nullable(values[index]));
                    assertTime(row, column + "_published_at", values == null ? null : plan.hourlyRequests().getFirst().times().publishedAt());
                    assertTime(row, column + "_collected_at", values == null ? null : collectedAt);
                }
            }
        }
        assertThat(count("weather_daily_forecasts")).isEqualTo(dailyCount);
    }

    private double[] tokens(final byte[] body) {
        String text = new String(body, StandardCharsets.UTF_8).strip();
        String[] tokens = text.split(",");
        assertThat(tokens).hasSize(GridPoint.CELL_COUNT);
        return Arrays.stream(tokens).map(String::strip).mapToDouble(Double::parseDouble).toArray();
    }

    private Set<Integer> validIndices(final double[] values) {
        Set<Integer> indices = new HashSet<>();
        for (int index = 0; index < values.length; index++) {
            if (nullable(values[index]) != null) {
                indices.add(index);
            }
        }
        return indices;
    }

    private Double nullable(final double value) {
        return value == -99 || value == -999 ? null : value;
    }

    private void assertTime(final Map<String, Object> row, final String column, final LocalDateTime expected) {
        Object value = row.get(column);
        assertThat(value instanceof Timestamp timestamp ? timestamp.toLocalDateTime() : value).isEqualTo(expected);
    }

    private int index(final Map<String, Object> row) {
        return (((Number) row.get("grid_y")).intValue() - 1) * GridPoint.WIDTH + ((Number) row.get("grid_x")).intValue() - 1;
    }

    private long count(final String table) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Long.class);
    }

    private String raw(final KmaForecastRequest request) {
        String[] values = new String[GridPoint.CELL_COUNT];
        Arrays.fill(values, "-99");
        for (int index = 0; index < VALID_POINTS; index++) {
            values[index] = Double.toString(switch (request.element()) {
                case TMP -> request.times().forecastAt().getHour() - 10 + index % 7 * 0.1;
                case TMN -> -7.5;
                case TMX -> 21.5;
                case REH -> 65;
                case SKY -> 1;
                case WSD -> 0.7;
                default -> 0;
            });
        }
        if (request.element() == WeatherElement.TMN || request.element() == WeatherElement.REH) {
            values[0] = "-999";
        }
        if (request.element() == WeatherElement.TMX || request.element() == WeatherElement.SKY) {
            values[2000] = "22";
        }
        if (request.element() == WeatherElement.TMP && request.times().forecastAt().getHour() % 2 == 1) {
            // 시각마다 TMP 범위를 바꿔 날짜별 합집합과 일별 두 요소 모두 결측인 격자를 검증한다.
            values[VALID_POINTS - 1] = "-99";
            values[1500] = "-1.5";
        }
        return String.join(",", values) + ",\n";
    }
}
