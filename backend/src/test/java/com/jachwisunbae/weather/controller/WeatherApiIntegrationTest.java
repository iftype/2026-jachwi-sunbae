package com.jachwisunbae.weather.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jachwisunbae.auth.token.JwtTokenProvider;
import com.jachwisunbae.weather.domain.DailyForecast;
import com.jachwisunbae.weather.domain.DailyTemperature;
import com.jachwisunbae.weather.domain.ForecastTimes;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.HourlyForecast;
import com.jachwisunbae.weather.repository.JdbcWeatherForecastRepository;
import com.jachwisunbae.weather.repository.MemberWeatherLocationRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(WeatherApiIntegrationTest.FixedClockConfig.class)
class WeatherApiIntegrationTest {
    @Container
    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.10");
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-25T13:00:00Z"), ZoneOffset.UTC);
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 25);
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtTokenProvider tokens;
    @Autowired
    private JdbcWeatherForecastRepository forecasts;
    @Autowired
    private MemberWeatherLocationRepository locations;

    @DynamicPropertySource
    static void database(final DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> MYSQL.getJdbcUrl()
                + "?connectionTimeZone=%2B00:00&forceConnectionTimeZoneToSession=true");
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
    }

    @TestConfiguration
    static class FixedClockConfig {
        @Bean
        @Primary
        Clock weatherTestClock() {
            return CLOCK;
        }
    }

    @BeforeEach
    void setup() {
        jdbc.update("DELETE FROM member_weather_locations");
        jdbc.update("DELETE FROM members");
        jdbc.update("DELETE FROM weather_forecasts");
        jdbc.update("DELETE FROM weather_daily_forecasts");
        jdbc.update("DELETE FROM weather_collection_publications");
        jdbc.update("INSERT INTO members (id, nickname, created_at, updated_at) VALUES (1, '첫회원', NOW(), NOW()), (2, '둘째회원', NOW(), NOW())");

    }

    @Test
    void returnsOnlySelectedGridDateAndVerifiedValuesWithKstMetadata() throws Exception {
        var publication = TODAY.atTime(20, 0);
        complete(publication);
        forecasts.upsertHourly(List.of(hourly(new GridPoint(60, 127), TODAY.atTime(23, 0), publication, 0.0),
                hourly(new GridPoint(98, 76), TODAY.atTime(23, 0), publication, 99.0),
                hourly(new GridPoint(60, 127), TODAY.plusDays(1).atStartOfDay(), publication, 88.0)));
        complete(TODAY.atTime(2, 0));
        complete(TODAY.atTime(11, 0));
        forecasts.upsertDaily(List.of(new DailyForecast(new GridPoint(60, 127), TODAY,
                new DailyTemperature(0.0, TODAY.atTime(2, 0), TODAY.atTime(2, 20)),
                new DailyTemperature(null, TODAY.atTime(11, 0), TODAY.atTime(11, 20)))));
        mvc.perform(get("/api/weather/forecasts").header("Authorization", bearer(1))
                        .param("latitude", "37.5665").param("longitude", "126.978"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.gridX").value(60))
                .andExpect(jsonPath("$.data.hourly.length()").value(24))
                .andExpect(jsonPath("$.data.hourly[23].values.TMP.value").value(0.0))
                .andExpect(jsonPath("$.data.hourly[23].values.TMP.status").value("AVAILABLE"))
                .andExpect(jsonPath("$.data.hourly[23].values.TMP.publishedAt").value("2026-10-25T20:00:00+09:00"))
                .andExpect(jsonPath("$.data.hourly[0].values.TMP.status").value("NOT_COLLECTED"))
                .andExpect(jsonPath("$.data.tmn.value").value(0.0))
                .andExpect(jsonPath("$.data.tmx.status").value("MISSING"));
    }

    @Test
    void incompleteRecollectionDoesNotExposePreviousOrPartialValues() throws Exception {
        var publication = TODAY.atTime(20, 0);
        complete(publication);
        forecasts.upsertHourly(List.of(hourly(new GridPoint(60, 127), TODAY.atTime(23, 0), publication, 22.0)));
        forecasts.startCollection(publication, publication.plusHours(1));
        assertUnverified();
        forecasts.completeCollection(publication, publication.plusMinutes(90));
        assertUnverified(); // 이전 시도에 저장된 행은 이번 완료 범위에 들어가지 않는다.
    }

    @Test
    void validatesAuthenticationCoordinatesDatesAndMissingParameters() throws Exception {
        mvc.perform(get("/api/weather/forecasts").param("latitude", "37").param("longitude", "127"))
                .andExpect(status().isUnauthorized());
        for (String invalid : List.of("NaN", "Infinity", "91", "bad")) {
            mvc.perform(get("/api/weather/forecasts").header("Authorization", bearer(1))
                    .param("latitude", invalid).param("longitude", "127")).andExpect(status().isBadRequest());
        }
        mvc.perform(get("/api/weather/forecasts").header("Authorization", bearer(1))
                .param("latitude", "37").param("longitude", "127").param("date", "2026-10-27"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("WEATHER_DATE_UNSUPPORTED"));
        mvc.perform(get("/api/weather/forecasts").header("Authorization", bearer(1)).param("latitude", "37"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/weather/forecasts").header("Authorization", bearer(1))
                .param("latitude", "34").param("longitude", "125").param("date", "2026-10-26"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.coverage").value("UNAVAILABLE"));
    }

    @Test
    void synchronizesOnlyAuthenticatedMemberWithoutPersistingExactCoordinates() throws Exception {
        mvc.perform(put("/api/members/me/weather-location").header("Authorization", bearer(1))
                .contentType(MediaType.APPLICATION_JSON).content(locationBody("2026-10-25T12:59:00Z")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.gridX").value(60))
                .andExpect(jsonPath("$.data.observedAt").value("2026-10-25T12:59:00Z"));
        mvc.perform(get("/api/members/me/weather-location").header("Authorization", bearer(2)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.available").value(false));
        assertThat(locations.find(1).orElseThrow().grid()).isEqualTo(new GridPoint(60, 127));
        assertThat(locations.find(2)).isEmpty();
        assertThat(jdbc.queryForList("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'member_weather_locations'", String.class))
                .doesNotContain("latitude", "longitude");
        mvc.perform(put("/api/members/me/weather-location").contentType(MediaType.APPLICATION_JSON)
                .content(locationBody("2026-10-25T12:59:00Z"))).andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsOldAndFutureCacheAndKeepsObservedTimeOnReplay() throws Exception {
        for (String time : List.of("2026-10-25T12:54:59Z", "2026-10-25T13:01:01Z")) {
            String body = mvc.perform(put("/api/members/me/weather-location").header("Authorization", bearer(1))
                    .contentType(MediaType.APPLICATION_JSON).content(locationBody(time)))
                    .andExpect(status().isBadRequest()).andReturn().getResponse().getContentAsString();
            assertThat(body).doesNotContain("37.5665", "126.978");
        }
        locations.sync(1, new GridPoint(60, 127), CLOCK.instant().minusSeconds(60), CLOCK.instant().minusSeconds(30));
        locations.sync(1, new GridPoint(98, 76), CLOCK.instant().minusSeconds(61), CLOCK.instant());
        locations.sync(1, new GridPoint(98, 76), CLOCK.instant().minusSeconds(60), CLOCK.instant());
        assertThat(locations.find(1).orElseThrow().grid()).isEqualTo(new GridPoint(60, 127));
        assertThat(locations.find(1).orElseThrow().syncedAt()).isEqualTo(CLOCK.instant().minusSeconds(30));
        locations.sync(1, new GridPoint(60, 127), CLOCK.instant().minusSeconds(1), CLOCK.instant());
        assertThat(locations.find(1).orElseThrow().observedAt()).isEqualTo(CLOCK.instant().minusSeconds(1));
    }

    @Test
    void revocationPreventsAnInFlightOldPositionFromRestoringTheGrid() throws Exception {
        mvc.perform(delete("/api/members/me/weather-location").header("Authorization", bearer(1)))
                .andExpect(status().isNoContent());
        mvc.perform(put("/api/members/me/weather-location").header("Authorization", bearer(1))
                .contentType(MediaType.APPLICATION_JSON).content(locationBody("2026-10-25T12:59:00Z")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.available").value(false));
        locations.sync(1, new GridPoint(98, 76), CLOCK.instant().plusSeconds(1), CLOCK.instant().plusSeconds(2));
        assertThat(locations.find(1).orElseThrow().grid()).isEqualTo(new GridPoint(98, 76));
        mvc.perform(delete("/api/members/me/weather-location").header("Authorization", bearer(2)))
                .andExpect(status().isNoContent());
        assertThat(locations.find(1).orElseThrow().isAvailable()).isTrue();
    }

    private void assertUnverified() throws Exception {
        mvc.perform(get("/api/weather/forecasts").header("Authorization", bearer(1))
                .param("latitude", "37.5665").param("longitude", "126.978"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.hourly[23].values.TMP.status").value("UNVERIFIED"))
                .andExpect(jsonPath("$.data.hourly[23].values.TMP.value").isEmpty());
    }

    @Test
    void rejectsMissingObservationAndUnknownMembersAndAllowsExactTimeBoundaries() throws Exception {
        mvc.perform(put("/api/members/me/weather-location").header("Authorization", bearer(1))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"latitude\":37,\"longitude\":127}"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/members/me/weather-location").header("Authorization", bearer(999)))
                .andExpect(status().isNotFound());
        for (String observed : List.of("2026-10-25T12:55:00Z", "2026-10-25T13:01:00Z")) {
            mvc.perform(put("/api/members/me/weather-location").header("Authorization", bearer(1))
                            .contentType(MediaType.APPLICATION_JSON).content(locationBody(observed)))
                    .andExpect(status().isOk());
        }
    }

    @Test
    void publishesWeatherContractsWithAuthenticationInOpenApi() throws Exception {
        mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/weather/forecasts'].get.security[0].bearerAuth").isArray())
                .andExpect(jsonPath("$.paths['/api/members/me/weather-location'].put.requestBody.required").value(true))
                .andExpect(jsonPath("$.paths['/api/members/me/weather-location'].delete.responses['204']").exists());
    }

    private String bearer(final long memberId) {
        return "Bearer " + tokens.createAccessToken(memberId);
    }

    private String locationBody(final String observedAt) {
        return "{\"latitude\":37.5665,\"longitude\":126.978,\"observedAt\":\"" + observedAt + "\",\"memberId\":2}";
    }

    private void complete(final LocalDateTime published) {
        forecasts.startCollection(published, published.plusMinutes(15));
        forecasts.completeCollection(published, published.plusMinutes(30));
    }

    private HourlyForecast hourly(final GridPoint grid, final LocalDateTime target,
                                   final LocalDateTime publication, final double temperature) {
        return new HourlyForecast(grid, new ForecastTimes(publication, target), temperature, 1.0, 0.0, 0.0,
                0.0, 0.0, 55.0, 1.0, publication.plusMinutes(20));
    }
}
