package com.jachwisunbae.weather.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
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
    private ObjectMapper objectMapper;
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
        jdbc.update("DELETE FROM refresh_tokens");
        jdbc.update("DELETE FROM members");
        jdbc.update("DELETE FROM weather_forecasts");
        jdbc.update("DELETE FROM weather_daily_forecasts");
        jdbc.update("DELETE FROM weather_collection_publications");
        jdbc.update("INSERT INTO members (id, created_at, updated_at) VALUES (1, NOW(), NOW()), (2, NOW(), NOW())");

    }

    @Test
    void anonymousLoginRestorationAndRefreshKeepTheMembersWeatherLocationAndConsent() throws Exception {
        var login = mvc.perform(post("/api/auth/login"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.newMember").value(true))
                .andReturn().getResponse();
        var data = objectMapper.readTree(login.getContentAsString()).path("data");
        long memberId = data.path("member").path("memberId").asLong();
        String authorization = "Bearer " + data.path("accessToken").asText();
        var refreshCookie = login.getCookie("refresh_token");
        assertThat(refreshCookie).isNotNull();

        mvc.perform(put("/api/members/me/weather-location").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(locationBody(37.5665, 126.978)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.gridX").value(60));
        mvc.perform(put("/api/members/me/weather-notification-settings").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":true}"))
                .andExpect(status().isOk());
        assertThat(locations.find(memberId).orElseThrow().grid()).isEqualTo(new GridPoint(60, 127));
        assertThat(locations.find(1)).isEmpty();

        var publication = TODAY.atTime(20, 0);
        complete(publication);
        forecasts.upsertHourly(List.of(hourly(new GridPoint(60, 127), TODAY.atTime(23, 0), publication, 12.0)));
        for (String path : List.of("/api/auth/login", "/api/auth/refresh")) {
            var restored = mvc.perform(post(path).cookie(refreshCookie))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.newMember").value(false))
                    .andExpect(jsonPath("$.data.member.memberId").value(memberId))
                    .andReturn().getResponse();
            authorization = "Bearer " + objectMapper.readTree(restored.getContentAsString()).path("data").path("accessToken").asText();
            refreshCookie = restored.getCookie("refresh_token");
            assertThat(refreshCookie).isNotNull();
            mvc.perform(get("/api/members/me/weather-location").header("Authorization", authorization))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.gridX").value(60));
            mvc.perform(get("/api/members/me/weather-notification-settings").header("Authorization", authorization))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.enabled").value(true));
            mvc.perform(get("/api/weather/forecasts").header("Authorization", authorization)
                            .param("latitude", "37.5665").param("longitude", "126.978"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.hourly[23].tmp").value(12.0));
        }
        mvc.perform(get("/api/members/me/weather-notification-settings").header("Authorization", bearer(1)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.enabled").value(false));
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
                .andExpect(jsonPath("$.data.hourly[23].tmp").value(0.0))
                .andExpect(jsonPath("$.data.hourly[23].publishedAt").value("2026-10-25T20:00:00+09:00"))
                .andExpect(jsonPath("$.data.hourly[0].tmp").isEmpty())
                .andExpect(jsonPath("$.data.tmn").value(0.0))
                .andExpect(jsonPath("$.data.tmx").isEmpty());
    }

    @Test
    void incompleteRecollectionDoesNotExposePreviousOrPartialValues() throws Exception {
        var publication = TODAY.atTime(20, 0);
        complete(publication);
        forecasts.upsertHourly(List.of(hourly(new GridPoint(60, 127), TODAY.atTime(23, 0), publication, 22.0)));
        forecasts.startCollection(publication);
        assertUnverified();
        forecasts.completeCollection(publication, publication.plusMinutes(90));
        mvc.perform(get("/api/weather/forecasts").header("Authorization", bearer(1))
                        .param("latitude", "37.5665").param("longitude", "126.978"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.hourly[23].tmp").value(22.0));
    }

    @Test
    void dailyValuesRequireTheirOwnCompletedPublication() throws Exception {
        var minimumPublication = TODAY.atTime(2, 0);
        var maximumPublication = TODAY.atTime(11, 0);
        complete(minimumPublication);
        forecasts.startCollection(maximumPublication);
        forecasts.upsertDaily(List.of(new DailyForecast(new GridPoint(60, 127), TODAY,
                new DailyTemperature(-5.0, minimumPublication, minimumPublication.plusMinutes(20)),
                new DailyTemperature(20.0, maximumPublication, maximumPublication.plusMinutes(20)))));
        mvc.perform(get("/api/weather/forecasts").header("Authorization", bearer(1))
                        .param("latitude", "37.5665").param("longitude", "126.978"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.tmn").value(-5.0))
                .andExpect(jsonPath("$.data.tmnPublishedAt").value("2026-10-25T02:00:00+09:00"))
                .andExpect(jsonPath("$.data.tmx").isEmpty()).andExpect(jsonPath("$.data.tmxPublishedAt").isEmpty());
    }

    @Test
    void validatesAuthenticationCoordinatesAndMissingParameters() throws Exception {
        mvc.perform(get("/api/weather/forecasts").param("latitude", "37").param("longitude", "127"))
                .andExpect(status().isUnauthorized());
        for (String invalid : List.of("NaN", "Infinity", "91", "bad")) {
            mvc.perform(get("/api/weather/forecasts").header("Authorization", bearer(1))
                    .param("latitude", invalid).param("longitude", "127")).andExpect(status().isBadRequest());
        }
        mvc.perform(get("/api/weather/forecasts").header("Authorization", bearer(1)).param("latitude", "37"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/weather/forecasts").header("Authorization", bearer(1))
                .param("latitude", "34").param("longitude", "125").param("date", "2026-10-26"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.hourly[0].tmp").isEmpty());
    }

    @Test
    void synchronizesOnlyAuthenticatedMemberWithoutPersistingExactCoordinates() throws Exception {
        mvc.perform(put("/api/members/me/weather-location").header("Authorization", bearer(1))
                .contentType(MediaType.APPLICATION_JSON).content(locationBody(37.5665, 126.978)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.available").value(true))
                .andExpect(jsonPath("$.data.gridX").value(60)).andExpect(jsonPath("$.data.gridY").value(127))
                .andExpect(jsonPath("$.data.updatedAt").value("2026-10-25T13:00:00Z"))
                .andExpect(jsonPath("$.data.length()").value(4));
        mvc.perform(get("/api/members/me/weather-location").header("Authorization", bearer(2)).param("memberId", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.available").value(false));
        assertThat(locations.find(1).orElseThrow().grid()).isEqualTo(new GridPoint(60, 127));
        assertThat(locations.find(2)).isEmpty();
        assertThat(jdbc.queryForList("""
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = 'member_weather_locations' ORDER BY ordinal_position
                """, String.class)).containsExactly("member_id", "grid_x", "grid_y", "updated_at");
        mvc.perform(put("/api/members/me/weather-location").contentType(MediaType.APPLICATION_JSON)
                .content(locationBody(37.5665, 126.978))).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/members/me/weather-location")).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/members/me/weather-location")).andExpect(status().isUnauthorized());
    }

    @Test
    void replacesTheMembersGridEvenWhenTheServerTimestampIsUnchanged() throws Exception {
        locations.sync(1, new GridPoint(98, 76), CLOCK.instant().minusSeconds(7 * 86400));
        mvc.perform(put("/api/members/me/weather-location").header("Authorization", bearer(1))
                        .contentType(MediaType.APPLICATION_JSON).content(locationBody(37.5665, 126.978)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.gridX").value(60));
        mvc.perform(put("/api/members/me/weather-location").header("Authorization", bearer(1))
                        .contentType(MediaType.APPLICATION_JSON).content(locationBody(35.1796, 129.0756)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.gridX").value(98))
                .andExpect(jsonPath("$.data.gridY").value(76));
        mvc.perform(get("/api/members/me/weather-location").header("Authorization", bearer(1)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.gridX").value(98))
                .andExpect(jsonPath("$.data.updatedAt").value("2026-10-25T13:00:00Z"));
        assertThat(locations.find(1).orElseThrow().updatedAt()).isEqualTo(CLOCK.instant());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM member_weather_locations WHERE member_id = 1", Integer.class)).isOne();
    }

    @Test
    void deletesOnlyTheMembersRowAndAllowsTheSameRequestToRegisterAgain() throws Exception {
        String request = locationBody(37.5665, 126.978);
        mvc.perform(put("/api/members/me/weather-location").header("Authorization", bearer(1))
                        .contentType(MediaType.APPLICATION_JSON).content(request)).andExpect(status().isOk());
        mvc.perform(delete("/api/members/me/weather-location").header("Authorization", bearer(2)))
                .andExpect(status().isNoContent());
        assertThat(locations.find(1)).isPresent();
        for (int attempt = 0; attempt < 2; attempt++) {
            mvc.perform(delete("/api/members/me/weather-location").header("Authorization", bearer(1)))
                    .andExpect(status().isNoContent());
        }
        assertThat(locations.find(1)).isEmpty();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM member_weather_locations", Integer.class)).isZero();
        mvc.perform(get("/api/members/me/weather-location").header("Authorization", bearer(1)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.available").value(false))
                .andExpect(jsonPath("$.data.gridX").isEmpty()).andExpect(jsonPath("$.data.gridY").isEmpty())
                .andExpect(jsonPath("$.data.updatedAt").isEmpty()).andExpect(jsonPath("$.data.length()").value(4));
        mvc.perform(put("/api/members/me/weather-location").header("Authorization", bearer(1))
                        .contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.available").value(true));
        assertThat(locations.find(1).orElseThrow().grid()).isEqualTo(new GridPoint(60, 127));
    }

    private void assertUnverified() throws Exception {
        mvc.perform(get("/api/weather/forecasts").header("Authorization", bearer(1))
                .param("latitude", "37.5665").param("longitude", "126.978"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hourly[23].tmp").isEmpty());
    }

    @Test
    void rejectsInvalidLocationCoordinatesAndUnknownMembers() throws Exception {
        for (String body : List.of("{}", "{\"latitude\":37}", "{\"longitude\":127}",
                locationBody(91, 127), locationBody(37, 181), locationBody(0, 0),
                "{\"latitude\":\"NaN\",\"longitude\":127}")) {
            mvc.perform(put("/api/members/me/weather-location").header("Authorization", bearer(1))
                            .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        }
        assertThat(locations.find(1)).isEmpty();
        mvc.perform(get("/api/members/me/weather-location").header("Authorization", bearer(999)))
                .andExpect(status().isNotFound());
        mvc.perform(put("/api/members/me/weather-location").header("Authorization", bearer(999))
                        .contentType(MediaType.APPLICATION_JSON).content(locationBody(37.5665, 126.978)))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/members/me/weather-location").header("Authorization", bearer(999)))
                .andExpect(status().isNotFound());
    }

    @Test
    void publishesWeatherContractsWithAuthenticationInOpenApi() throws Exception {
        mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/weather/forecasts'].get.security[0].bearerAuth").isArray())
                .andExpect(jsonPath("$.paths['/api/members/me/weather-location'].put.requestBody.required").value(true))
                .andExpect(jsonPath("$.paths['/api/members/me/weather-location'].delete.responses['204']").exists())
                .andExpect(jsonPath("$.components.schemas.WeatherLocationRequest.properties.length()").value(2))
                .andExpect(jsonPath("$.components.schemas.WeatherLocationRequest.properties.observedAt").doesNotExist())
                .andExpect(jsonPath("$.components.schemas.WeatherLocationResponse.properties.updatedAt").exists())
                .andExpect(jsonPath("$.components.schemas.WeatherLocationResponse.properties.length()").value(4));
    }

    private String bearer(final long memberId) {
        return "Bearer " + tokens.createAccessToken(memberId);
    }

    private String locationBody(final double latitude, final double longitude) {
        return """
                {"latitude": %s, "longitude": %s, "memberId": 2}
                """.formatted(latitude, longitude);
    }

    private void complete(final LocalDateTime published) {
        forecasts.startCollection(published);
        forecasts.completeCollection(published, published.plusMinutes(30));
    }

    private HourlyForecast hourly(final GridPoint grid, final LocalDateTime target,
                                   final LocalDateTime publication, final double temperature) {
        return new HourlyForecast(grid, new ForecastTimes(publication, target), temperature, 1.0, 0.0, 0.0,
                0.0, 0.0, 55.0, 1.0, publication.plusMinutes(20));
    }
}
