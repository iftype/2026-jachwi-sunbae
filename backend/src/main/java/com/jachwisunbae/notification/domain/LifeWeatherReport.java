package com.jachwisunbae.notification.domain;

import java.util.List;

// 필수 예보가 준비되었는지와 실제 안내할 조건만 담는다. 목록에 없다고 해당 날씨가 없다는 뜻은 아니다.
public record LifeWeatherReport(boolean sendable, String title, String body, List<Notice> notices) {
    public LifeWeatherReport {
        notices = List.copyOf(notices);
    }

    public enum Condition {
        SNOW, RAIN, FREEZE, TEMPERATURE_SWING, LAUNDRY
    }

    public record Notice(Condition condition, String message) { }
}
