package com.jachwisunbae.weather.notification.controller.dto;

import com.jachwisunbae.weather.controller.dto.WeatherForecastResponse;
import com.jachwisunbae.weather.notification.service.WeatherNotificationHistoryService.Detail;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Schema(description = "발송 준비 당시의 위치·날씨·판정 스냅샷. 현재 위치나 현재 예보로 다시 계산하지 않음")
public record WeatherNotificationResponse(UUID notificationId, LocalDate sendDate, String slot, LocalDate targetDate,
                                          int gridX, int gridY, Instant locationObservedAt, Instant preparedAt, Instant expiresAt,
                                          String policyVersion, boolean precipitationContractVerified, String title, String body,
                                          List<Assessment> assessments, WeatherForecastResponse forecast, List<Delivery> deliveries) {
    public static WeatherNotificationResponse from(final Detail detail) {
        var n = detail.notification();
        var snapshot = detail.snapshot();
        return new WeatherNotificationResponse(n.notificationId(), n.sendDate(), n.slot().name(), n.targetDate(), n.grid().nx(), n.grid().ny(),
                n.locationObservedAt(), n.preparedAt(), n.expiresAt(), snapshot.policyVersion(), snapshot.precipitationContractVerified(),
                snapshot.report().title(), snapshot.report().body(), snapshot.report().assessments().stream().map(item ->
                        new Assessment(item.condition().name(), item.verdict().name(), item.reason(), item.message(),
                                item.forecastTimes().stream().map(at -> at.atOffset(ZoneOffset.ofHours(9))).toList())).toList(),
                WeatherForecastResponse.from(snapshot.forecast()), detail.deliveries().stream().map(item ->
                        new Delivery(item.installationId(), item.status().name(), item.attempts(), item.errorCode(),
                                item.finishedAt(), item.receivedAt(), item.openedAt())).toList());
    }

    public record Assessment(String condition,
                              @Schema(description = "CAUTION, RECOMMENDED, NOT_APPLICABLE, UNKNOWN") String verdict,
                              String reason, String message, List<OffsetDateTime> forecastTimes) { }

    public record Delivery(UUID installationId,
                            @Schema(description = "ACCEPTED는 FCM 요청 수락이며 휴대폰 도착 확인이 아님. 수신·열람 시각은 앱 보고") String status,
                            int attempts, String errorCode, Instant finishedAt, Instant receivedAt, Instant openedAt) { }
}
