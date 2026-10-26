package com.jachwisunbae.notification.controller.dto;

import com.jachwisunbae.notification.domain.WeatherNotification;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Schema(description = "알림 당시의 격자·문구·7가지 판정. 현재 예보로 다시 계산하지 않습니다.")
public record WeatherNotificationResponse(UUID notificationId, LocalDate sendDate, String slot, LocalDate targetDate,
                                          int gridX, int gridY, String title, String body, List<Assessment> assessments,
                                          @Schema(description = "SUCCESS: FCM 요청 수락, FAILED: 발송 실패 또는 조건 변경, null: 결과 미기록. 기기 도착 확인이 아닙니다.") String result) {
    public static WeatherNotificationResponse from(final WeatherNotification n) {
        return new WeatherNotificationResponse(n.notificationId(), n.sendDate(), n.slot().name(), n.targetDate(), n.grid().nx(), n.grid().ny(),
                n.title(), n.body(), n.assessments().stream().map(item -> new Assessment(item.condition().name(), item.verdict().name(),
                        item.reason(), item.message(), item.forecastTimes().stream().map(at -> at.atOffset(ZoneOffset.ofHours(9))).toList())).toList(),
                n.result() == null ? null : n.result().name());
    }

    public record Assessment(String condition,
                              @Schema(description = "CAUTION, RECOMMENDED, NOT_APPLICABLE, UNKNOWN") String verdict,
                              String reason, String message, List<OffsetDateTime> forecastTimes) { }
}
