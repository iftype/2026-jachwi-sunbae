package com.jachwisunbae.notification.domain;

import static com.jachwisunbae.notification.domain.LifeWeatherReport.Condition.FREEZE;
import static com.jachwisunbae.notification.domain.LifeWeatherReport.Condition.LAUNDRY;
import static com.jachwisunbae.notification.domain.LifeWeatherReport.Condition.RAIN;
import static com.jachwisunbae.notification.domain.LifeWeatherReport.Condition.SNOW;
import static com.jachwisunbae.notification.domain.LifeWeatherReport.Condition.TEMPERATURE_SWING;

import com.jachwisunbae.notification.domain.LifeWeatherForecast.Hour;
import com.jachwisunbae.notification.domain.LifeWeatherReport.Notice;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.stream.IntStream;

// 공식 기상특보가 아닌 생활 안내다. 조건에 해당하는 안내만 메시지 우선순위대로 만든다.
public final class LifeWeatherRules {
    private static final String DEFAULT_BODY = "마지막으로 확인한 위치 기준이에요. 상세 날씨를 확인해 주세요.";

    public LifeWeatherReport evaluate(final LifeWeatherForecast forecast) {
        List<Hour> hours = forecast.hours().stream().sorted(Comparator.comparing(Hour::at)).toList();
        if (!isReady(forecast, hours)) {
            return new LifeWeatherReport(false, null, null, List.of());
        }
        List<Notice> notices = new ArrayList<>();
        if (hasSnow(hours)) {
            notices.add(new Notice(SNOW, "눈 예보가 있어요. 이동에 주의하세요"));
        }
        if (hasRain(hours)) {
            notices.add(new Notice(RAIN, "비 예보가 있어요. 우산을 준비하세요"));
        }
        if (needsColdPrecaution(hours, forecast.minimum())) {
            notices.add(new Notice(FREEZE, "추위 예보가 있어요. 노출된 수도관 보온을 점검하세요"));
        }
        if (hasLargeTemperatureSwing(forecast.minimum(), forecast.maximum())) {
            notices.add(new Notice(TEMPERATURE_SWING, "일교차가 10℃ 이상이에요. 겉옷을 준비하세요"));
        }
        if (canRecommendLaundry(hours)) {
            notices.add(new Notice(LAUNDRY, "09~18시 예보상 바깥 건조를 고려할 수 있어요"));
        }
        return readyReport(forecast, hours, notices);
    }

    // 모든 대상 시각의 TMP·PTY는 필수다. 선택 요소가 없어도 전체 알림은 만들 수 있다.
    private boolean isReady(final LifeWeatherForecast forecast, final List<Hour> hours) {
        List<LocalDateTime> expected = IntStream.range(forecast.slot().firstForecastHour(), 24)
                .mapToObj(hour -> forecast.date().atTime(hour, 0)).toList();
        return hours.stream().map(Hour::at).toList().equals(expected)
                && hours.stream().allMatch(hour -> hour.temperature() != null && hour.precipitationType() != null);
    }

    private LifeWeatherReport readyReport(final LifeWeatherForecast forecast, final List<Hour> hours,
                                          final List<Notice> notices) {
        String prefix = forecast.slot() == NotificationSlot.MORNING ? "오늘 " : "내일 ";
        String title = notices.isEmpty() ? temperatureRange(forecast.slot(), hours) : notices.getFirst().message();
        // 목록은 눈 → 비 → 추위 → 일교차 → 빨래 순서다. 두 번째 주의만 본문에 쓴다.
        String body = notices.size() > 1 && notices.get(1).condition() != LAUNDRY
                ? prefix + notices.get(1).message() : DEFAULT_BODY;
        return new LifeWeatherReport(true, prefix + title, body, notices);
    }

    private boolean hasSnow(final List<Hour> hours) {
        return hours.stream().anyMatch(hour -> hour.precipitationType() == 2 || hour.precipitationType() == 3);
    }

    private boolean hasRain(final List<Hour> hours) {
        return hours.stream().anyMatch(hour -> hour.precipitationType() == 1
                || hour.precipitationType() == 2 || hour.precipitationType() == 4);
    }

    private boolean needsColdPrecaution(final List<Hour> hours, final Double minimum) {
        return hours.stream().anyMatch(hour -> hour.temperature() <= -5)
                || minimum != null && minimum <= -5;
    }

    private boolean hasLargeTemperatureSwing(final Double minimum, final Double maximum) {
        return minimum != null && maximum != null && maximum - minimum >= 10;
    }

    private boolean canRecommendLaundry(final List<Hour> hours) {
        List<Hour> daytime = hours.stream().filter(hour -> hour.at().getHour() >= 9 && hour.at().getHour() <= 18).toList();
        return daytime.size() == 10
                && daytime.stream().allMatch(hour -> hour.precipitationType() == 0 && hour.humidity() != null)
                && daytime.stream().mapToDouble(Hour::humidity).average().orElseThrow() <= 60;
    }

    private String temperatureRange(final NotificationSlot slot, final List<Hour> hours) {
        double low = hours.stream().mapToDouble(Hour::temperature).min().orElseThrow();
        double high = hours.stream().mapToDouble(Hour::temperature).max().orElseThrow();
        return String.format(Locale.ROOT, "%02d~23시 예보기온 %.0f~%.0f℃", slot.firstForecastHour(), low, high);
    }

}
