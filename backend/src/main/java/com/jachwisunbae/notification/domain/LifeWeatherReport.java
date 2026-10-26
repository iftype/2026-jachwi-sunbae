package com.jachwisunbae.notification.domain;

import java.time.LocalDateTime;
import java.util.List;

// LifeWeatherRules의 평가 결과. 알림 발송 여부·문구와 7개 항목별 판정을 담는다.
// sendable: 알림을 보낼 수 있는지
// reason: 결과 사유 (READY, FORECAST_NOT_READY, ESSENTIAL_VALUES_MISSING)
// title·body: 알림 문구. 보낼 수 없으면 null
// assessments: 항목별 판정. 보낼 수 없는 경우에도 채워지며, 발송한 알림에는 이력으로 함께 저장된다.
public record LifeWeatherReport(boolean sendable, String reason, String title, String body,
                                List<Assessment> assessments) {
    public LifeWeatherReport {
        assessments = List.copyOf(assessments);
    }

    // 평가하는 생활 날씨 항목
    public enum Condition {
        RAIN,              // 비
        SNOW,              // 눈
        FREEZE,            // 한파(수도관 동파)
        TEMPERATURE_SWING, // 일교차
        DRY,               // 건조
        LAUNDRY,           // 빨래(바깥 건조)
        VENTILATION        // 환기
    }

    // 항목별 판정
    public enum Verdict {
        CAUTION,        // 주의가 필요함
        RECOMMENDED,    // 하기 좋음 (빨래·환기)
        NOT_APPLICABLE, // 기준에 해당하지 않음
        UNKNOWN         // 자료가 부족하거나 해석이 엇갈려 판단할 수 없음
    }

    // 한 항목의 판정 결과
    // reason: 판정 근거 코드 (예: PRECIPITATION_TYPE, BELOW_THRESHOLD)
    // message: 알림 문구에 쓰는 안내 문장
    // forecastTimes: 판정 근거가 된 예보 시각들
    public record Assessment(Condition condition, Verdict verdict, String reason, String message,
                             List<LocalDateTime> forecastTimes) {
        public Assessment {
            forecastTimes = List.copyOf(forecastTimes);
        }
    }
}
