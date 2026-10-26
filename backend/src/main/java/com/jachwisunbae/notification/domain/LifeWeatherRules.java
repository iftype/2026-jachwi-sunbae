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
    private static final String TITLE = "자취선배 생활정보";

    public LifeWeatherReport evaluate(final LifeWeatherForecast forecast) {
        List<Hour> hours = forecast.hours().stream().sorted(Comparator.comparing(Hour::at)).toList();
        if (!isReady(forecast, hours)) {
            return new LifeWeatherReport(false, null, null, List.of());
        }
        String day = forecast.slot() == NotificationSlot.MORNING ? "오늘" : "내일";
        List<Notice> notices = new ArrayList<>();
        if (hasSnow(hours)) {
            notices.add(new Notice(SNOW, day + " 눈이 예상돼요. 이동할 때 주의하세요!"));
        }
        if (hasRain(hours)) {
            notices.add(new Notice(RAIN, day + " 비 예보가 있어요. 우산을 챙기세요!"));
        }
        if (needsColdPrecaution(hours, forecast.minimum())) {
            notices.add(new Notice(FREEZE, day + " 영하 5℃ 이하 추위가 예상돼요. 수도관 보온을 점검하세요!"));
        }
        if (hasLargeTemperatureSwing(forecast.minimum(), forecast.maximum())) {
            notices.add(new Notice(TEMPERATURE_SWING, day + " 일교차가 10℃ 이상이에요. 겉옷을 챙기세요!"));
        }
        if (canRecommendLaundry(hours)) {
            notices.add(new Notice(LAUNDRY, day + "은 비 예보가 없고 습도가 낮아요. 빨래하기 괜찮겠어요!"));
        }
        // 목록은 눈 → 비 → 추위 → 일교차 → 빨래 순서이며, 가장 앞선 안내 하나만 본문에 쓴다.
        String body = notices.isEmpty() ? temperatureRange(day, forecast.slot(), hours) : notices.getFirst().message();
        return new LifeWeatherReport(true, TITLE, body, notices);
    }

    // 모든 대상 시각의 TMP·PTY는 필수다. 선택 요소가 없어도 전체 알림은 만들 수 있다.
    private boolean isReady(final LifeWeatherForecast forecast, final List<Hour> hours) {
        List<LocalDateTime> expected = IntStream.range(forecast.slot().firstForecastHour(), 24)
                .mapToObj(hour -> forecast.date().atTime(hour, 0)).toList();
        return hours.stream().map(Hour::at).toList().equals(expected)
                && hours.stream().allMatch(hour -> hour.temperature() != null && hour.precipitationType() != null);
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

    private String temperatureRange(final String day, final NotificationSlot slot, final List<Hour> hours) {
        double low = hours.stream().mapToDouble(Hour::temperature).min().orElseThrow();
        double high = hours.stream().mapToDouble(Hour::temperature).max().orElseThrow();
        return String.format(Locale.ROOT, "%s %02d~23시 예보기온 %.0f~%.0f℃", day, slot.firstForecastHour(), low, high);
    }

}
