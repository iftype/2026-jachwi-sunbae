package com.jachwisunbae.weather.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jachwisunbae.auth.token.JwtTokenProvider;
import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.weather.domain.ForecastTimes;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.HourlyForecast;
import com.jachwisunbae.weather.domain.WeatherElement;
import com.jachwisunbae.weather.notification.domain.NotificationSlot;
import com.jachwisunbae.weather.notification.domain.PreparedWeatherNotification;
import com.jachwisunbae.weather.notification.domain.WeatherDelivery;
import com.jachwisunbae.weather.notification.domain.WeatherDelivery.Status;
import com.jachwisunbae.weather.notification.domain.WeatherDevice;
import com.jachwisunbae.weather.notification.domain.WeatherDevice.Permission;
import com.jachwisunbae.weather.notification.domain.WeatherDevice.Platform;
import com.jachwisunbae.weather.notification.provider.WeatherPushSender;
import com.jachwisunbae.weather.notification.provider.WeatherPushSender.Outcome;
import com.jachwisunbae.weather.notification.provider.WeatherPushSender.Push;
import com.jachwisunbae.weather.notification.provider.WeatherPushSender.Result;
import com.jachwisunbae.weather.notification.repository.WeatherNotificationRepository;
import com.jachwisunbae.weather.notification.repository.WeatherNotificationSettingsRepository;
import com.jachwisunbae.weather.notification.service.WeatherNotificationDispatchService;
import com.jachwisunbae.weather.notification.service.WeatherNotificationPreparationService;
import com.jachwisunbae.weather.notification.service.WeatherNotificationSettingsService;
import com.jachwisunbae.weather.notification.service.WeatherNotificationSnapshotCodec;
import com.jachwisunbae.weather.repository.JdbcWeatherForecastRepository;
import com.jachwisunbae.weather.repository.MemberWeatherLocationRepository;
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
    @Container
    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.10");
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
    @Autowired private WeatherNotificationSettingsService settings;
    @Autowired private WeatherNotificationSettingsRepository settingsRepository;
    @Autowired private WeatherNotificationRepository notifications;
    @Autowired private WeatherNotificationPreparationService preparation;
    @Autowired private WeatherNotificationSnapshotCodec codec;
    @Autowired private WeatherNotificationDispatchService disabledDispatch;
    private final List<Push> pushes = new CopyOnWriteArrayList<>();
    private Function<Push, Result> outcome;
    private WeatherNotificationDispatchService dispatch;
    private UUID device;

    @DynamicPropertySource
    static void database(final DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> MYSQL.getJdbcUrl() + "?connectionTimeZone=%2B00:00&forceConnectionTimeZoneToSession=true");
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
        jdbc.update("INSERT INTO members (id, nickname, created_at, updated_at) VALUES (1, '첫회원', NOW(), NOW()), (2, '둘째회원', NOW(), NOW())");
        pushes.clear();
        outcome = push -> Result.accepted("fake-project/messages/accepted");
        dispatch = newDispatch();
        device = register(1).installationId();
        settings.setEnabled(1, true);
        locations.sync(1, GRID, MORNING.minusSeconds(60), MORNING);
        seedForecasts(NotificationSlot.MORNING, DATE.atTime(5, 0));
    }

    @Test
    void oneSnapshotPerSlotAndOneRequestPerDeviceSurvivesRepeatedRunsAndNewDispatcher() {
        register(1);
        assertThat(dispatch.dispatchCurrentSlot().accepted()).isEqualTo(2);
        assertThat(dispatch.dispatchCurrentSlot().attempts()).isZero();
        assertThat(newDispatch().dispatchCurrentSlot().attempts()).isZero();
        assertThat(notifications.recent(1, 100)).hasSize(1);
        assertThat(pushes).hasSize(2).allMatch(push -> push.notificationId().equals(notification().notificationId()));
        assertThat(notifications.deliveries(notification().notificationId()))
                .allMatch(value -> value.status() == Status.ACCEPTED && value.attempts() == 1);
        var snapshot = codec.read(notification().snapshot());
        assertThat(snapshot.report().assessments()).hasSize(7);
        assertThat(snapshot.precipitationContractVerified()).isFalse();
        assertThat(snapshot.forecast().hourly().get(7).values().get(WeatherElement.TMP).publishedAt()).isEqualTo(DATE.atTime(5, 0));
    }

    @Test
    void settingsAreOffForNewMemberAndResponsesDoNotExposeSecrets() throws Exception {
        mvc.perform(get("/api/members/me/weather-notification-settings").header("Authorization", bearer(2)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.enabled").value(false));
        String response = mvc.perform(get("/api/members/me/weather-devices").header("Authorization", bearer(1)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(1))
                .andReturn().getResponse().getContentAsString();
        assertThat(response).doesNotContain(SECRET, "secretHash", "token", settingsRepository.device(device).orElseThrow().token());
        mvc.perform(put("/api/members/me/weather-notification-settings").header("Authorization", bearer(2))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":true,\"memberId\":1}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.enabled").value(true));
        mvc.perform(get("/api/members/me/weather-devices")).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/members/me/weather-devices/" + device).header("Authorization", bearer(2))).andExpect(status().isNotFound());
        mvc.perform(put("/api/members/me/weather-notification-settings").header("Authorization", bearer(1))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void installationTransferRequiresSecretAndDoesNotCopyMemberConsent() throws Exception {
        prepare();
        String oldToken = settingsRepository.device(device).orElseThrow().token();
        assertThatThrownBy(() -> settings.register(2, device, SECRET + "wrong", oldToken, Platform.ANDROID, Permission.GRANTED))
                .isInstanceOf(InvalidInputException.class);
        settings.register(2, device, SECRET, oldToken, Platform.ANDROID, Permission.GRANTED);
        assertThat(settings.devices(1)).isEmpty();
        assertThat(settings.devices(2)).hasSize(1);
        assertThat(settings.enabled(2)).isFalse();
        assertThat(dispatch.dispatchCurrentSlot().attempts()).isZero();
        assertThat(pushes).isEmpty();
        mvc.perform(delete("/api/members/me/weather-devices/" + device).header("Authorization", bearer(1))).andExpect(status().isNotFound());
    }

    @Test
    void duplicateTokenIsRejectedButIdenticalRegistrationPreservesPendingDelivery() throws Exception {
        var old = settingsRepository.device(device).orElseThrow();
        prepare();
        var same = settings.register(1, device, SECRET, old.token(), old.platform(), old.permission());
        assertThat(same.version()).isEqualTo(old.version());
        String response = mvc.perform(put("/api/members/me/weather-devices/" + UUID.randomUUID()).header("Authorization", bearer(2))
                        .contentType(MediaType.APPLICATION_JSON).content(deviceBody(SECRET, old.token(), "GRANTED")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("WEATHER_DEVICE_CONFLICT"))
                .andReturn().getResponse().getContentAsString();
        assertThat(response).doesNotContain(old.token(), SECRET, "INSERT", "token_hash");
        assertThat(dispatch.dispatchCurrentSlot().accepted()).isOne();
    }

    @Test
    void validatesDeviceInputAndClearsTokenOnPermissionRevocation() throws Exception {
        mvc.perform(put("/api/members/me/weather-devices/" + UUID.randomUUID()).header("Authorization", bearer(1))
                        .contentType(MediaType.APPLICATION_JSON).content(deviceBody("short", "short", "GRANTED")))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/members/me/weather-devices/" + device).header("Authorization", bearer(1))
                        .contentType(MediaType.APPLICATION_JSON).content(deviceBody(SECRET, "unused-token-long-enough", "DENIED")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.active").value(false));
        assertThat(settingsRepository.device(device).orElseThrow().token()).isNull();
        assertThat(dispatch.dispatchCurrentSlot().attempts()).isZero();
        mvc.perform(get("/api/members/me/weather-notifications").header("Authorization", bearer(999))).andExpect(status().isNotFound());
    }

    @ParameterizedTest
    @ValueSource(longs = {86401, -61})
    void invalidLocationAgePreventsPreparation(final long secondsOld) {
        jdbc.update("DELETE FROM member_weather_locations");
        locations.sync(1, GRID, CLOCK.instant().minusSeconds(secondsOld), CLOCK.instant());
        assertThat(dispatch.dispatchCurrentSlot().attempts()).isZero();
        assertThat(notifications.recent(1, 100)).isEmpty();
    }

    @Test
    void exactLocationAgeBoundaryIsAllowedButMissingLocationIsNot() {
        jdbc.update("DELETE FROM member_weather_locations");
        assertThat(dispatch.dispatchCurrentSlot().attempts()).isZero();
        locations.sync(1, GRID, CLOCK.instant().minusSeconds(86400), CLOCK.instant());
        assertThat(dispatch.dispatchCurrentSlot().accepted()).isOne();
    }

    @Test
    void incompleteOrOldPublicationWaitsForCurrentCompletedCollection() {
        forecasts.startCollection(DATE.atTime(5, 0), DATE.atTime(6, 0));
        assertThat(dispatch.dispatchCurrentSlot().attempts()).isZero();
        jdbc.update("DELETE FROM weather_forecasts");
        jdbc.update("DELETE FROM weather_collection_publications");
        seedForecasts(NotificationSlot.MORNING, DATE.atTime(2, 0));
        assertThat(dispatch.dispatchCurrentSlot().attempts()).isZero();
        seedForecasts(NotificationSlot.MORNING, DATE.atTime(5, 0));
        assertThat(dispatch.dispatchCurrentSlot().accepted()).isOne();
    }

    @Test
    void missingEssentialHourPreventsSendAndMissingDailyValuesStayExplicit() {
        jdbc.update("DELETE FROM weather_forecasts WHERE forecast_at = ?", DATE.atTime(23, 0));
        assertThat(dispatch.dispatchCurrentSlot().attempts()).isZero();
        seedForecasts(NotificationSlot.MORNING, DATE.atTime(5, 0));
        assertThat(dispatch.dispatchCurrentSlot().accepted()).isOne();
        assertThat(codec.read(notification().snapshot()).report().assessments())
                .anyMatch(value -> value.reason().equals("DAILY_TEMPERATURES_MISSING_OR_INVALID"));
    }

    @Test
    void optOutCancelsPreparedDeliveryEvenAfterReenable() {
        var prepared = prepare();
        settings.setEnabled(1, false);
        settings.setEnabled(1, true);
        assertThat(dispatch.dispatchCurrentSlot().attempts()).isZero();
        assertThat(notifications.deliveries(prepared.notificationId()).getFirst().status()).isEqualTo(Status.CANCELLED);
    }

    @Test
    void changedLocationOrTokenAfterPreparationCannotSendOldSnapshot() {
        var prepared = prepare();
        locations.sync(1, new GridPoint(98, 76), MORNING, MORNING);
        assertThat(dispatch.dispatchCurrentSlot().attempts()).isZero();
        assertThat(notifications.deliveries(prepared.notificationId()).getFirst().status()).isEqualTo(Status.CANCELLED);
        assertThat(pushes).isEmpty();
    }

    @Test
    void rotatedTokenAfterPreparationIsNotUsedWithOldRegistrationVersion() {
        prepare();
        settings.register(1, device, SECRET, "rotated-valid-fake-token-1234567890", Platform.ANDROID, Permission.GRANTED);
        assertThat(dispatch.dispatchCurrentSlot().attempts()).isZero();
        assertThat(pushes).isEmpty();
    }

    @Test
    void quotaRetryWaitsAndStopsAfterThreeAttempts() {
        outcome = push -> Result.failed(Outcome.RETRYABLE, "QUOTA_EXCEEDED");
        assertThat(dispatch.dispatchCurrentSlot().attempts()).isOne();
        assertThat(delivery().status()).isEqualTo(Status.RETRY);
        assertThat(dispatch.dispatchCurrentSlot().attempts()).isZero();
        CLOCK.advance(300);
        assertThat(dispatch.dispatchCurrentSlot().attempts()).isOne();
        CLOCK.advance(300);
        assertThat(newDispatch().dispatchCurrentSlot().attempts()).isOne();
        assertThat(delivery().status()).isEqualTo(Status.FAILED);
        CLOCK.advance(300);
        assertThat(dispatch.dispatchCurrentSlot().attempts()).isZero();
        assertThat(pushes).hasSize(3);
    }

    @Test
    void onlyRetryableDeviceIsRetried() {
        var second = register(1);
        outcome = push -> push.token().equals(second.token()) ? Result.failed(Outcome.RETRYABLE, "QUOTA_EXCEEDED") : Result.accepted("accepted");
        assertThat(dispatch.dispatchCurrentSlot().attempts()).isEqualTo(2);
        CLOCK.advance(300);
        outcome = push -> Result.accepted("accepted-after-retry");
        assertThat(dispatch.dispatchCurrentSlot().attempts()).isOne();
        assertThat(pushes).hasSize(3);
    }

    @Test
    void uncertainAndInterruptedSendsAreNeverAutomaticallyRepeated() {
        outcome = push -> Result.failed(Outcome.UNKNOWN, "UNAVAILABLE");
        assertThat(dispatch.dispatchCurrentSlot().attempts()).isOne();
        assertThat(delivery().status()).isEqualTo(Status.UNKNOWN);
        CLOCK.advance(360);
        assertThat(newDispatch().dispatchCurrentSlot().attempts()).isZero();
        jdbc.update("UPDATE weather_notification_deliveries SET status = 'SENDING', claimed_at = ?", LocalDateTime.ofInstant(MORNING, ZoneOffset.UTC));
        assertThat(newDispatch().dispatchCurrentSlot().attempts()).isZero();
        assertThat(delivery().status()).isEqualTo(Status.UNKNOWN);
        assertThat(delivery().errorCode()).isEqualTo("INTERRUPTED_OR_TIMED_OUT");
        assertThat(pushes).hasSize(1);
    }

    @Test
    void invalidTokenResultDoesNotDisableTokenRotatedDuringRequest() {
        outcome = push -> {
            settings.register(1, device, SECRET, "new-valid-token-1234567890", Platform.ANDROID, Permission.GRANTED);
            return Result.failed(Outcome.INVALID_TOKEN, "UNREGISTERED");
        };
        dispatch.dispatchCurrentSlot();
        assertThat(settingsRepository.device(device).orElseThrow().active()).isTrue();
        assertThat(delivery().status()).isEqualTo(Status.FAILED);
        var current = settingsRepository.device(device).orElseThrow();
        settingsRepository.invalidateToken(device, current.version(), CLOCK.instant());
        assertThat(settingsRepository.device(device).orElseThrow().active()).isFalse();
        assertThat(settingsRepository.device(device).orElseThrow().token()).isNull();
    }

    @Test
    void expiredRetryAndFeatureOffDoNotCallProvider() {
        assertThat(disabledDispatch.dispatchCurrentSlot().status()).isEqualTo("DISABLED");
        CLOCK.advance(55 * 60);
        outcome = push -> Result.failed(Outcome.RETRYABLE, "QUOTA_EXCEEDED");
        dispatch.dispatchCurrentSlot();
        assertThat(delivery().status()).isEqualTo(Status.FAILED);
        CLOCK.advance(5 * 60);
        assertThat(dispatch.dispatchCurrentSlot().status()).isEqualTo("OUTSIDE_WINDOW");
        assertThat(pushes).hasSize(1);
    }

    @Test
    void eveningCreatesTomorrowSnapshotAndHistoryStaysAtOriginalLocation() throws Exception {
        dispatch.dispatchCurrentSlot();
        CLOCK.now.set(Instant.parse("2026-10-25T13:00:00Z"));
        seedForecasts(NotificationSlot.EVENING, DATE.atTime(20, 0));
        assertThat(dispatch.dispatchCurrentSlot().accepted()).isOne();
        var evening = notifications.find(1, DATE, NotificationSlot.EVENING).orElseThrow();
        locations.sync(1, new GridPoint(98, 76), CLOCK.instant(), CLOCK.instant());
        mvc.perform(get("/api/members/me/weather-notifications/" + evening.notificationId()).header("Authorization", bearer(1)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.targetDate").value("2026-10-26"))
                .andExpect(jsonPath("$.data.slot").value("EVENING"))
                .andExpect(jsonPath("$.data.gridX").value(60)).andExpect(jsonPath("$.data.assessments.length()").value(7))
                .andExpect(jsonPath("$.data.forecast.hourly[0].values.TMP.publishedAt").value("2026-10-25T20:00:00+09:00"));
        mvc.perform(get("/api/members/me/weather-notifications").header("Authorization", bearer(1)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].slot").value("EVENING"));
        assertThat(notifications.recent(1, 20)).hasSize(2);
    }

    @Test
    void ownDetailAndIdempotentClientReceiptAreSeparateFromFcmAcceptance() throws Exception {
        dispatch.dispatchCurrentSlot();
        String path = "/api/members/me/weather-notifications/" + notification().notificationId();
        mvc.perform(get(path).header("Authorization", bearer(2))).andExpect(status().isNotFound());
        mvc.perform(get(path).header("Authorization", bearer(1))).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.deliveries[0].status").value("ACCEPTED"))
                .andExpect(jsonPath("$.data.deliveries[0].receivedAt").isEmpty());
        for (String receipt : List.of("OPENED", "RECEIVED", "OPENED")) {
            mvc.perform(put(path + "/receipts/" + device).header("Authorization", bearer(1))
                            .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"" + receipt + "\"}"))
                    .andExpect(status().isNoContent());
            CLOCK.advance(1);
        }
        assertThat(delivery().receivedAt()).isEqualTo(MORNING);
        assertThat(delivery().openedAt()).isEqualTo(MORNING);
        mvc.perform(put(path + "/receipts/" + device).header("Authorization", bearer(2))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"OPENED\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/members/me/weather-notifications").param("limit", "101").header("Authorization", bearer(1)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void concurrentPreparationAndWorkersCannotClaimSameDeliveryTwice() throws Exception {
        try (var executor = Executors.newFixedThreadPool(2)) {
            var gate = new CountDownLatch(1);
            var first = executor.submit(() -> { gate.await(); return prepare(); });
            var second = executor.submit(() -> { gate.await(); return prepare(); });
            gate.countDown();
            assertThat(first.get(10, TimeUnit.SECONDS).notificationId()).isEqualTo(second.get(10, TimeUnit.SECONDS).notificationId());
            var entered = new CountDownLatch(1);
            var release = new CountDownLatch(1);
            outcome = push -> {
                entered.countDown();
                try { assertThat(release.await(10, TimeUnit.SECONDS)).isTrue(); }
                catch (InterruptedException e) { throw new IllegalStateException(e); }
                return Result.accepted("accepted");
            };
            var running = executor.submit(dispatch::dispatchCurrentSlot);
            assertThat(entered.await(10, TimeUnit.SECONDS)).isTrue();
            try {
                assertThat(dispatch.dispatchCurrentSlot().status()).isEqualTo("ALREADY_RUNNING");
                assertThat(newDispatch().dispatchCurrentSlot().attempts()).isZero();
            } finally { release.countDown(); }
            assertThat(running.get(10, TimeUnit.SECONDS).accepted()).isOne();
            assertThat(pushes).hasSize(1);
        }
    }

    @Test
    void concurrentRegistrationsCannotExceedMemberDeviceLimit() throws Exception {
        for (int i = 1; i < 9; i++) {
            register(1);
        }
        try (var executor = Executors.newFixedThreadPool(2)) {
            var gate = new CountDownLatch(1);
            java.util.concurrent.Callable<Boolean> registration = () -> {
                gate.await();
                try {
                    register(1);
                    return true;
                } catch (InvalidInputException exception) {
                    assertThat(exception.getErrorCode().name()).isEqualTo("WEATHER_DEVICE_LIMIT_EXCEEDED");
                    return false;
                }
            };
            var first = executor.submit(registration);
            var second = executor.submit(registration);
            gate.countDown();
            assertThat(List.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(true, false);
            assertThat(settings.devices(1)).filteredOn(WeatherDevice::active).hasSize(10);
        }
    }

    @Test
    void openApiPublishesAuthenticatedBackendContracts() throws Exception {
        mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/members/me/weather-devices/{installationId}'].put.security[0].bearerAuth").isArray())
                .andExpect(jsonPath("$.paths['/api/members/me/weather-notifications/{notificationId}'].get").exists())
                .andExpect(jsonPath("$.paths['/api/members/me/weather-notifications/{notificationId}/receipts/{installationId}'].put.responses['204']").exists());
    }

    private WeatherNotificationDispatchService newDispatch() {
        WeatherPushSender sender = push -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            pushes.add(push);
            return outcome.apply(push);
        };
        return new WeatherNotificationDispatchService(settingsRepository, notifications, preparation, codec, sender, CLOCK, true);
    }

    private WeatherDevice register(final long member) {
        var id = UUID.randomUUID();
        return settings.register(member, id, SECRET, "fake-fcm-token-" + id, Platform.ANDROID, Permission.GRANTED);
    }

    private PreparedWeatherNotification prepare() { return preparation.prepare(1, DATE, NotificationSlot.MORNING).orElseThrow(); }
    private PreparedWeatherNotification notification() { return notifications.find(1, DATE, NotificationSlot.MORNING).orElseThrow(); }
    private WeatherDelivery delivery() { return notifications.deliveries(notification().notificationId()).getFirst(); }
    private String bearer(final long member) { return "Bearer " + tokens.createAccessToken(member); }
    private String deviceBody(final String secret, final String token, final String permission) {
        return "{\"installationSecret\":\"" + secret + "\",\"token\":\"" + token + "\",\"platform\":\"ANDROID\",\"permission\":\"" + permission + "\"}";
    }

    private void seedForecasts(final NotificationSlot slot, final LocalDateTime publication) {
        forecasts.startCollection(publication, publication.plusMinutes(15));
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
        void advance(final long seconds) { now.updateAndGet(value -> value.plusSeconds(seconds)); }
    }
}
