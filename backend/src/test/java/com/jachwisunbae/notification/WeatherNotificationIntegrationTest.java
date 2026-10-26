package com.jachwisunbae.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jachwisunbae.auth.token.JwtTokenProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jachwisunbae.notification.domain.LifeWeatherReport.Condition;
import com.jachwisunbae.notification.domain.LifeWeatherReport.Notice;
import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.weather.domain.ForecastTimes;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.HourlyForecast;
import com.jachwisunbae.notification.domain.NotificationSlot;
import com.jachwisunbae.notification.domain.WeatherDevice;
import com.jachwisunbae.notification.domain.WeatherNotification;
import com.jachwisunbae.notification.provider.WeatherPushSender;
import com.jachwisunbae.notification.provider.WeatherPushSender.Push;
import com.jachwisunbae.notification.repository.WeatherNotificationRepository;
import com.jachwisunbae.notification.repository.WeatherNotificationSettingsRepository;
import com.jachwisunbae.notification.service.LifeWeatherAnalysisService;
import com.jachwisunbae.notification.service.WeatherNotificationDispatchService;
import com.jachwisunbae.notification.service.WeatherNotificationSettingsService;
import com.jachwisunbae.weather.repository.JdbcWeatherForecastRepository;
import com.jachwisunbae.weather.repository.MemberWeatherLocationRepository;
import com.jachwisunbae.weather.service.MemberWeatherLocationService;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Function;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@SpringBootTest(properties = "weather.notification.enabled=false")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(WeatherNotificationIntegrationTest.ClockConfig.class)
class WeatherNotificationIntegrationTest {
    @Container private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.10");
    private static final Instant MORNING = Instant.parse("2026-10-24T22:00:00Z");
    private static final LocalDate DATE = LocalDate.of(2026, 10, 25);
    private static final GridPoint GRID = new GridPoint(60, 127);
    private static final String SECRET = "test-installation-secret-with-at-least-43-characters";
    private static final MutableClock CLOCK = new MutableClock();
    @Autowired private JdbcTemplate jdbc;
    @Autowired private MockMvc mvc;
    @Autowired private JwtTokenProvider tokens;
    @Autowired private JdbcWeatherForecastRepository forecasts;
    @Autowired private MemberWeatherLocationRepository locations;
    @Autowired private MemberWeatherLocationService locationService;
    @Autowired private WeatherNotificationSettingsService settings;
    @Autowired private WeatherNotificationSettingsRepository settingsRepository;
    @Autowired private WeatherNotificationRepository notifications;
    @Autowired private LifeWeatherAnalysisService analysis;
    private final List<Push> pushes = new CopyOnWriteArrayList<>();
    private Function<Push, Boolean> outcome;
    private WeatherNotificationDispatchService dispatch;
    private WeatherDevice device;

    @DynamicPropertySource
    static void database(final DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
    }

    @TestConfiguration
    static class ClockConfig {
        @Bean @Primary Clock weatherNotificationTestClock() { return CLOCK; }
    }

    @BeforeEach
    void setup() {
        CLOCK.now.set(MORNING);
        jdbc.update("DELETE FROM members");
        jdbc.update("DELETE FROM weather_forecasts");
        jdbc.update("DELETE FROM weather_daily_forecasts");
        jdbc.update("DELETE FROM weather_collection_publications");
        jdbc.update("INSERT INTO members (id, created_at, updated_at) VALUES (1, NOW(), NOW()), (2, NOW(), NOW())");
        pushes.clear();
        outcome = push -> true;
        dispatch = newDispatch(analysis);
        device = register(1);
        settings.setEnabled(1, true);
        locations.sync(1, GRID, MORNING);
        seedForecasts(NotificationSlot.MORNING, DATE.atTime(5, 0));
    }

    @Test
    void sendsOneCombinedPushAndPreservesOnlyMatchingNotices() throws Exception {
        dispatch.dispatch(NotificationSlot.MORNING);
        dispatch.dispatch(NotificationSlot.MORNING);
        assertThat(pushes).hasSize(1);
        var saved = notification();
        assertThat(saved.notices()).extracting(Notice::condition).containsExactly(Condition.LAUNDRY);
        assertThat(pushes.getFirst().notificationId()).isEqualTo(saved.notificationId());
        String json = jdbc.queryForObject("SELECT notices FROM weather_notifications", String.class);
        assertThat(new ObjectMapper().readTree(json)).isEqualTo(new ObjectMapper().readTree("""
                [{"condition":"LAUNDRY","message":"오늘은 비 예보가 없고 습도가 낮아요. 빨래하기 괜찮겠어요!"}]
                """));
        jdbc.update("DELETE FROM weather_forecasts");
        locations.sync(1, new GridPoint(61, 120), MORNING.plusSeconds(1));
        mvc.perform(get("/api/members/me/weather-notifications/" + saved.notificationId()).header("Authorization", bearer(1)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.gridX").value(60))
                .andExpect(jsonPath("$.data.notices.length()").value(1)).andExpect(jsonPath("$.data.result").doesNotExist())
                .andExpect(jsonPath("$.data.notices[0].condition").value("LAUNDRY"))
                .andExpect(jsonPath("$.data.notices[0].message").value("오늘은 비 예보가 없고 습도가 낮아요. 빨래하기 괜찮겠어요!"))
                .andExpect(jsonPath("$.data.assessments").doesNotExist())
                .andExpect(jsonPath("$.data.notices[0].verdict").doesNotExist())
                .andExpect(jsonPath("$.data.notices[0].reason").doesNotExist())
                .andExpect(jsonPath("$.data.notices[0].forecastTimes").doesNotExist());
        assertThat(notifications.findOwned(1, saved.notificationId()).orElseThrow().notices()).isEqualTo(saved.notices());
    }

    @Test
    void testPushDoesNotSaveNotificationAndReportsMissingDevice() throws Exception {
        mvc.perform(post("/api/members/me/weather-notifications/test").header("Authorization", bearer(1)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.sent").value(false));
        mvc.perform(post("/api/members/me/weather-notifications/test").header("Authorization", bearer(2)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.sent").value(false));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM weather_notifications", Integer.class)).isZero();
    }

    @Test
    void summaryWithEmptyNoticesRoundTripsWithoutOptionalData() throws Exception {
        jdbc.update("UPDATE weather_forecasts SET reh = NULL, pop = NULL, pcp = NULL, sno = NULL, wsd = NULL");
        dispatch.dispatch(NotificationSlot.MORNING);
        assertThat(pushes).hasSize(1);
        var saved = notification();
        assertThat(saved.notices()).isEmpty();
        assertThat(saved.body()).isEqualTo("오늘 07~23시 예보기온 15~15℃");
        assertThat(jdbc.queryForObject("SELECT notices FROM weather_notifications", String.class)).isEqualTo("[]");
        mvc.perform(get("/api/members/me/weather-notifications/" + saved.notificationId()).header("Authorization", bearer(1)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.notices").isEmpty());
    }

    @ParameterizedTest
    @ValueSource(strings = {"pop = 100, pcp = 10, sno = 10, wsd = 100", "pop = NULL, pcp = NULL, sno = NULL, wsd = NULL"})
    void unusedElementsNeitherCreateRainNorPreventLaundry(final String values) {
        jdbc.update("UPDATE weather_forecasts SET " + values);
        dispatch.dispatch(NotificationSlot.MORNING);
        assertThat(pushes).hasSize(1);
        assertThat(notification().notices()).extracting(Notice::condition).containsExactly(Condition.LAUNDRY);
    }

    @Test
    void eveningUsesTomorrowsFullDay() {
        CLOCK.now.set(Instant.parse("2026-10-25T13:00:00Z"));
        seedForecasts(NotificationSlot.EVENING, DATE.atTime(20, 0));
        dispatch.dispatch(NotificationSlot.EVENING);
        assertThat(pushes).hasSize(1);
        assertThat(notification().targetDate()).isEqualTo(DATE.plusDays(1));
        assertThat(notification().slot()).isEqualTo(NotificationSlot.EVENING);
    }

    @Test
    void failedFcmAttemptIsRecordedAndNeverRetried() {
        outcome = push -> false;
        dispatch.dispatch(NotificationSlot.MORNING);
        dispatch.dispatch(NotificationSlot.MORNING);
        assertThat(pushes).hasSize(1);
    }

    @Test
    void runtimeFailureIsRecordedWithoutLeakingOrRetrying() {
        outcome = push -> { throw new IllegalStateException("sensitive-provider-message"); };
        dispatch.dispatch(NotificationSlot.MORNING);
        dispatch.dispatch(NotificationSlot.MORNING);
        assertThat(pushes).hasSize(1);
    }

    @ParameterizedTest
    @ValueSource(strings = {"off", "permission", "location", "incomplete", "missing", "temperature", "hour"})
    void doesNotSendWithoutConsentLocationOrUsableForecasts(final String cause) {
        switch (cause) {
            case "off" -> settings.setEnabled(1, false);
            case "permission" -> settings.revoke(1);
            case "location" -> locationService.delete(1);
            case "incomplete" -> jdbc.update("UPDATE weather_collection_publications SET completed_at = NULL");
            case "missing" -> jdbc.update("UPDATE weather_forecasts SET pty = NULL WHERE HOUR(forecast_at) = 23");
            case "temperature" -> jdbc.update("UPDATE weather_forecasts SET tmp = NULL WHERE HOUR(forecast_at) = 23");
            case "hour" -> jdbc.update("DELETE FROM weather_forecasts WHERE HOUR(forecast_at) = 18");
            default -> throw new IllegalArgumentException();
        }
        dispatch.dispatch(NotificationSlot.MORNING);
        assertThat(pushes).isEmpty();
        assertThat(notificationCount()).isZero();
    }

    @ParameterizedTest
    @CsvSource({"MORNING, 1", "MORNING, 7", "EVENING, 7", "MORNING, -1"})
    void usesTheSavedGridWithoutCheckingItsTimestamp(final NotificationSlot slot, final int daysAgo) {
        Instant storedAt = MORNING.minusSeconds(daysAgo * 86400L);
        locations.sync(1, GRID, storedAt);
        if (slot == NotificationSlot.EVENING) {
            CLOCK.now.set(Instant.parse("2026-10-25T13:00:00Z"));
            seedForecasts(slot, DATE.atTime(20, 0));
        }
        dispatch.dispatch(slot);
        assertThat(pushes).hasSize(1);
        assertThat(notification().grid()).isEqualTo(GRID);
        assertThat(locations.find(1).orElseThrow().updatedAt()).isEqualTo(storedAt);
    }


    @ParameterizedTest
    @ValueSource(strings = {"consent", "member-transfer", "permission", "token"})
    void eligibilityIsRecheckedAfterAnalysisBeforeSending(final String change) {
        var changed = org.mockito.Mockito.spy(analysis);
        org.mockito.Mockito.doAnswer(call -> {
            var report = analysis.analyze(GRID, DATE, NotificationSlot.MORNING);
            switch (change) {
                case "consent" -> settings.setEnabled(1, false);
                case "member-transfer" -> settings.register(2, device.installationId(), SECRET, device.token());
                case "permission" -> settings.revoke(1);
                case "location" -> locationService.delete(1);
                case "token" -> settings.register(1, device.installationId(), SECRET, "replacement-fcm-token-1234567890");
                default -> throw new IllegalArgumentException();
            }
            return report;
        }).when(changed).analyze(GRID, DATE, NotificationSlot.MORNING);
        newDispatch(changed).dispatch(NotificationSlot.MORNING);
        assertThat(pushes).isEmpty();
    }

    @Test
    void oneMemberKeepsOneRegistrationAndUpdatesOrRevokesIt() {
        WeatherDevice replacement = register(1);
        assertThat(settings.device(1).orElseThrow().installationId()).isEqualTo(replacement.installationId());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM weather_notification_devices WHERE member_id=1", Integer.class)).isOne();
        settings.register(1, replacement.installationId(), SECRET, "new-fcm-token-1234567890");
        settings.register(1, replacement.installationId(), SECRET, "new-fcm-token-1234567890");
        assertThat(settings.device(1).orElseThrow().token()).isEqualTo("new-fcm-token-1234567890");
        settings.revoke(1);
        assertThat(settings.device(1)).isEmpty();
    }

    @Test
    void tokenAloneCannotTakeAnotherMembersRegistrationAndFailureRollsBackReplacement() {
        WeatherDevice second = register(2);
        assertThatThrownBy(() -> settings.register(2, UUID.randomUUID(), SECRET, device.token()))
                .isInstanceOf(InvalidInputException.class);
        assertThat(settings.device(1).orElseThrow().installationId()).isEqualTo(device.installationId());
        assertThat(settings.device(2).orElseThrow().installationId()).isEqualTo(second.installationId());
        assertThatThrownBy(() -> settings.register(2, device.installationId(), "different-installation-secret-with-at-least-43-characters", device.token()))
                .isInstanceOf(InvalidInputException.class);
    }

    @Test
    void anonymousMemberTransferRequiresProofAndDisconnectsThePreviousMember() {
        settings.register(2, device.installationId(), SECRET, device.token());
        assertThat(settings.device(1)).isEmpty();
        assertThat(settings.device(2).orElseThrow().memberId()).isEqualTo(2);
        assertThat(settings.enabled(2)).isFalse();
        dispatch.dispatch(NotificationSlot.MORNING);
        assertThat(pushes).isEmpty();
    }

    @Test
    void duplicateConcurrentJobsCreateOnlyOneNotificationAndAttempt() throws Exception {
        try (var executor = Executors.newFixedThreadPool(2)) {
            CountDownLatch start = new CountDownLatch(1);
            var first = executor.submit(() -> { start.await(); newDispatch(analysis).dispatch(NotificationSlot.MORNING); return null; });
            var second = executor.submit(() -> { start.await(); newDispatch(analysis).dispatch(NotificationSlot.MORNING); return null; });
            start.countDown();
            first.get(20, TimeUnit.SECONDS);
            second.get(20, TimeUnit.SECONDS);
        }
        assertThat(pushes).hasSize(1);
        assertThat(notificationCount()).isOne();
    }

    @Test
    void apiUsesOnePrivateRegistrationAndOwnedNotificationDetails() throws Exception {
        String body = "{\"installationId\":\"" + device.installationId() + "\",\"installationSecret\":\"" + SECRET
                + "\",\"token\":\"updated-fcm-token-1234567890\"}";
        mvc.perform(put("/api/members/me/weather-devices/current").header("Authorization", bearer(1)).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.token").doesNotExist()).andExpect(jsonPath("$.data.installationSecret").doesNotExist());
        mvc.perform(get("/api/members/me/weather-devices/current")).andExpect(status().isUnauthorized());
        dispatch.dispatch(NotificationSlot.MORNING);
        mvc.perform(get("/api/members/me/weather-notifications/" + notification().notificationId()).header("Authorization", bearer(2)))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/members/me/weather-devices/current").header("Authorization", bearer(1))).andExpect(status().isNoContent());
        assertThat(settings.device(1)).isEmpty();
        mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.paths['/api/members/me/weather-devices/current']").exists())
                .andExpect(jsonPath("$.paths['/api/members/me/weather-notifications/{notificationId}/receipts/{installationId}']").doesNotExist())
                .andExpect(jsonPath("$.paths['/api/members/me/weather-notifications']").doesNotExist())
                .andExpect(jsonPath("$.components.schemas.WeatherNotificationResponse.properties.notices").exists())
                .andExpect(jsonPath("$.components.schemas.WeatherNotificationResponse.properties.assessments").doesNotExist())
                .andExpect(jsonPath("$.components.schemas.WeatherNotice.properties.condition.enum.length()").value(5))
                .andExpect(jsonPath("$.components.schemas.WeatherNotice.properties.message").exists())
                .andExpect(jsonPath("$.components.schemas.WeatherNotice.properties.verdict").doesNotExist());
    }

    @ParameterizedTest
    @ValueSource(strings = {"installationId", "installationSecret", "token"})
    void rejectsInvalidRegistrationWithoutChangingCurrentDevice(final String invalidField) throws Exception {
        String id = invalidField.equals("installationId") ? "null" : "\"" + device.installationId() + "\"";
        String secret = invalidField.equals("installationSecret") ? "short" : SECRET;
        String token = invalidField.equals("token") ? "null" : "\"updated-fcm-token-1234567890\"";
        String body = """
                {"installationId": %s, "installationSecret": "%s", "token": %s}
                """.formatted(id, secret, token);
        mvc.perform(put("/api/members/me/weather-devices/current").header("Authorization", bearer(1))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        assertThat(settings.device(1)).contains(device);
    }

    @Test
    void completedOlderPublicationCanBeUsedForMorningNotification() {
        jdbc.update("DELETE FROM weather_forecasts");
        seedForecasts(NotificationSlot.MORNING, DATE.minusDays(1).atTime(23, 0));
        dispatch.dispatch(NotificationSlot.MORNING);
        assertThat(pushes).hasSize(1);
    }

    @Test
    void usesInitiallyReadLocationWhenItChangesDuringAnalysis() {
        var changed = org.mockito.Mockito.spy(analysis);
        org.mockito.Mockito.doAnswer(call -> {
            var report = analysis.analyze(GRID, DATE, NotificationSlot.MORNING);
            locations.delete(1);
            return report;
        }).when(changed).analyze(GRID, DATE, NotificationSlot.MORNING);
        newDispatch(changed).dispatch(NotificationSlot.MORNING);
        assertThat(pushes).hasSize(1);
        assertThat(notification().grid()).isEqualTo(GRID);
    }

    @Test
    void sensitiveObjectsDoNotExposeCredentialsOrLocation() {
        String token = "sensitive-fcm-token";
        var request = new com.jachwisunbae.notification.controller.dto.WeatherDeviceRequest(device.installationId(), SECRET, token);
        assertThat(request.toString()).doesNotContain(SECRET, token);
        assertThat(device.toString()).doesNotContain(SECRET, device.secretHash(), device.token());
        var push = new Push(UUID.randomUUID(), token, "제목", "본문");
        assertThat(push.toString()).doesNotContain(token);
        dispatch.dispatch(NotificationSlot.MORNING);
        assertThat(notification().toString()).isEqualTo("WeatherNotification[notificationId=" + notification().notificationId() + "]");
    }

    @Test
    void tokenValidationUsesOnlyBlankAndLengthLimits() throws Exception {
        for (String token : List.of("", " ", "x".repeat(4097))) {
            String body = new ObjectMapper().writeValueAsString(java.util.Map.of(
                    "installationId", device.installationId(), "installationSecret", SECRET, "token", token));
            mvc.perform(put("/api/members/me/weather-devices/current").header("Authorization", bearer(1))
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        }
        for (String token : List.of("x", "토큰", "x".repeat(4096))) {
            String body = new ObjectMapper().writeValueAsString(java.util.Map.of(
                    "installationId", device.installationId(), "installationSecret", SECRET, "token", token));
            mvc.perform(put("/api/members/me/weather-devices/current").header("Authorization", bearer(1))
                            .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());
            assertThat(settings.device(1).orElseThrow().token()).isEqualTo(token);
        }
    }

    private WeatherNotificationDispatchService newDispatch(final LifeWeatherAnalysisService analyzer) {
        WeatherPushSender sender = push -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            pushes.add(push);
            return outcome.apply(push);
        };
        return new WeatherNotificationDispatchService(settingsRepository, notifications, locations, analyzer, sender, CLOCK);
    }

    private WeatherDevice register(final long member) {
        UUID id = UUID.randomUUID();
        return settings.register(member, id, SECRET, "fake-fcm-token-" + id);
    }

    private int notificationCount() { return jdbc.queryForObject("SELECT COUNT(*) FROM weather_notifications", Integer.class); }
    private WeatherNotification notification() {
        UUID id = UUID.fromString(jdbc.queryForObject("SELECT notification_id FROM weather_notifications WHERE member_id=1", String.class));
        return notifications.findOwned(1, id).orElseThrow();
    }
    private String bearer(final long member) { return "Bearer " + tokens.createAccessToken(member); }

    private void seedForecasts(final NotificationSlot slot, final LocalDateTime publication) {
        forecasts.startCollection(publication);
        forecasts.upsertHourly(IntStream.range(slot.firstForecastHour(), 24).mapToObj(hour ->
                new HourlyForecast(GRID, new ForecastTimes(publication, slot.targetDate(DATE).atTime(hour, 0)),
                        15.0, 1.0, 0.0, 0.0, 0.0, 0.0, 55.0, 2.0, publication.plusMinutes(20))).toList());
        forecasts.completeCollection(publication, publication.plusMinutes(30));
    }

    private static class MutableClock extends Clock {
        private final AtomicReference<Instant> now = new AtomicReference<>(MORNING);
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(final ZoneId zone) { return Clock.fixed(instant(), zone); }
        @Override public Instant instant() { return now.get(); }
    }
}
