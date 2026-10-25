package com.jachwisunbae.weather.notification.domain;

import java.time.LocalDateTime;
import java.util.List;

public record LifeWeatherReport(boolean sendable, String reason, String title, String body,
                                List<Assessment> assessments) {
    public LifeWeatherReport {
        assessments = List.copyOf(assessments);
    }

    public enum Condition { RAIN, SNOW, FREEZE, TEMPERATURE_SWING, DRY, LAUNDRY, VENTILATION }
    public enum Verdict { CAUTION, RECOMMENDED, NOT_APPLICABLE, UNKNOWN }

    public record Assessment(Condition condition, Verdict verdict, String reason, String message,
                             List<LocalDateTime> forecastTimes) {
        public Assessment {
            forecastTimes = List.copyOf(forecastTimes);
        }
    }
}
