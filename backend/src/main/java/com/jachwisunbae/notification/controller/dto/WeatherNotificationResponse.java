package com.jachwisunbae.notification.controller.dto;

import com.jachwisunbae.notification.domain.WeatherNotification;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Schema(description = "알림 당시의 격자·문구·실제 생활 안내. 현재 예보로 다시 계산하지 않습니다.")
public record WeatherNotificationResponse(UUID notificationId, LocalDate sendDate, String slot, LocalDate targetDate,
                                          int gridX, int gridY, String title, String body,
                                          @Schema(description = "조건을 충족한 안내만 우선순위대로 반환합니다. 빈 목록이면 기온 요약 알림이며, 항목 부재가 해당 날씨의 부재를 보장하지 않습니다.") List<Notice> notices) {
    public static WeatherNotificationResponse from(final WeatherNotification n) {
        return new WeatherNotificationResponse(n.notificationId(), n.sendDate(), n.slot().name(), n.targetDate(), n.grid().nx(), n.grid().ny(),
                n.title(), n.body(), n.notices().stream().map(item -> new Notice(item.condition().name(), item.message())).toList());
    }

    @Schema(name = "WeatherNotice", description = "실제 조건을 충족한 생활 날씨 안내")
    public record Notice(
            @Schema(description = "SNOW·RAIN·FREEZE·TEMPERATURE_SWING은 주의, LAUNDRY는 추천입니다.",
                    allowableValues = {"SNOW", "RAIN", "FREEZE", "TEMPERATURE_SWING", "LAUNDRY"}) String condition,
            String message) { }
}
