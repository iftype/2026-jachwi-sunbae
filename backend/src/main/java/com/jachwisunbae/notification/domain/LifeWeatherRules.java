package com.jachwisunbae.notification.domain;

import static com.jachwisunbae.weather.domain.WeatherElement.PCP;
import static com.jachwisunbae.weather.domain.WeatherElement.POP;
import static com.jachwisunbae.weather.domain.WeatherElement.PTY;
import static com.jachwisunbae.weather.domain.WeatherElement.REH;
import static com.jachwisunbae.weather.domain.WeatherElement.SNO;
import static com.jachwisunbae.weather.domain.WeatherElement.TMP;
import static com.jachwisunbae.weather.domain.WeatherElement.WSD;
import static com.jachwisunbae.notification.domain.LifeWeatherReport.Condition.DRY;
import static com.jachwisunbae.notification.domain.LifeWeatherReport.Condition.FREEZE;
import static com.jachwisunbae.notification.domain.LifeWeatherReport.Condition.LAUNDRY;
import static com.jachwisunbae.notification.domain.LifeWeatherReport.Condition.RAIN;
import static com.jachwisunbae.notification.domain.LifeWeatherReport.Condition.SNOW;
import static com.jachwisunbae.notification.domain.LifeWeatherReport.Condition.TEMPERATURE_SWING;
import static com.jachwisunbae.notification.domain.LifeWeatherReport.Condition.VENTILATION;
import static com.jachwisunbae.notification.domain.LifeWeatherReport.Verdict.CAUTION;
import static com.jachwisunbae.notification.domain.LifeWeatherReport.Verdict.NOT_APPLICABLE;
import static com.jachwisunbae.notification.domain.LifeWeatherReport.Verdict.RECOMMENDED;
import static com.jachwisunbae.notification.domain.LifeWeatherReport.Verdict.UNKNOWN;

import com.jachwisunbae.weather.domain.WeatherElement;
import com.jachwisunbae.notification.domain.LifeWeatherForecast.Hour;
import com.jachwisunbae.notification.domain.LifeWeatherReport.Assessment;
import com.jachwisunbae.notification.domain.LifeWeatherReport.Condition;
import com.jachwisunbae.notification.domain.LifeWeatherReport.Verdict;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.function.Predicate;
import java.util.stream.IntStream;

// 공식 기상특보가 아닌 초기 생활 안내 정책이다.
// 시간별 예보를 7개 항목(비·눈·한파·일교차·건조·빨래·환기)으로 평가하고, 그 결과로 알림 제목·본문을 만든다.
public final class LifeWeatherRules {
    // 알림 문구에 쓸 항목의 우선순위. 앞쪽일수록 제목에 먼저 나온다.
    private static final List<Condition> PRIORITY = List.of(SNOW, RAIN, FREEZE, TEMPERATURE_SWING, DRY, LAUNDRY, VENTILATION);
    // 주의(CAUTION)여도 알림 제목·본문에는 이 항목들만 쓴다.
    private static final List<Condition> ALERT_CONDITIONS = List.of(SNOW, RAIN, FREEZE, TEMPERATURE_SWING);
    private static final String DEFAULT_BODY = "마지막으로 확인한 위치 기준이에요. 상세 날씨를 확인해 주세요.";
    private static final String UNKNOWN_BODY = "판단할 수 없는 생활 날씨 항목이 있어요. 상세 내용을 확인해 주세요.";

    public LifeWeatherReport evaluate(final LifeWeatherForecast forecast) {
        List<Hour> hours = forecast.hours().stream().sorted(Comparator.comparing(Hour::at)).toList();
        if (!isReady(forecast, hours)) {
            return new LifeWeatherReport(false, "FORECAST_NOT_READY", null, null,
                    PRIORITY.stream().map(type -> unknown(type, "FORECAST_NOT_READY")).toList());
        }
        // 결과 순서는 응답·이력에 그대로 저장된다.
        List<Assessment> results = List.of(rain(hours), snow(hours), freeze(hours, forecast.minimum()), swing(forecast),
                dry(hours), laundry(hours), ventilation(hours));
        // 기온·강수형태는 알림의 필수 값이다. 하나라도 없으면 평가 결과만 남기고 보내지 않는다.
        if (!allValid(hours, TMP, PTY)) {
            return new LifeWeatherReport(false, "ESSENTIAL_VALUES_MISSING", null, null, results);
        }
        return readyReport(forecast, hours, results);
    }

    // 조회 단계에서 출처가 확인됐고, 분석할 시각(아침 07~23시, 저녁 00~23시)이 빠짐없이 있어야 한다.
    private boolean isReady(final LifeWeatherForecast forecast, final List<Hour> hours) {
        List<LocalDateTime> expected = IntStream.range(forecast.slot().firstForecastHour(), 24)
                .mapToObj(hour -> forecast.date().atTime(hour, 0)).toList();
        return forecast.sourceVerified() && hours.stream().map(Hour::at).toList().equals(expected);
    }

    // 제목 선택 순서: 주의 항목 > 추천 항목 > 기온 범위 요약
    private LifeWeatherReport readyReport(final LifeWeatherForecast forecast, final List<Hour> hours,
                                          final List<Assessment> results) {
        String prefix = forecast.slot() == NotificationSlot.MORNING ? "오늘 " : "내일 ";
        List<Assessment> cautions = results.stream()
                .filter(value -> value.verdict() == CAUTION && ALERT_CONDITIONS.contains(value.condition()))
                .sorted(Comparator.comparingInt(value -> PRIORITY.indexOf(value.condition())))
                .toList();
        if (!cautions.isEmpty()) {
            // 주의가 둘 이상이면 두 번째 주의를 본문에 쓴다.
            String body = cautions.size() > 1 ? prefix + cautions.get(1).message() : DEFAULT_BODY;
            return new LifeWeatherReport(true, "READY", prefix + cautions.getFirst().message(), body, results);
        }
        Assessment recommendation = results.stream().filter(value -> value.verdict() == RECOMMENDED).findFirst().orElse(null);
        if (recommendation != null) {
            return new LifeWeatherReport(true, "READY", prefix + recommendation.message(), DEFAULT_BODY, results);
        }
        String body = results.stream().anyMatch(value -> value.verdict() == UNKNOWN) ? UNKNOWN_BODY : DEFAULT_BODY;
        return new LifeWeatherReport(true, "READY", prefix + temperatureRange(forecast, hours), body, results);
    }

    private String temperatureRange(final LifeWeatherForecast forecast, final List<Hour> hours) {
        double low = hours.stream().mapToDouble(hour -> hour.value(TMP)).min().orElseThrow();
        double high = hours.stream().mapToDouble(hour -> hour.value(TMP)).max().orElseThrow();
        return String.format(Locale.ROOT, "%02d~23시 예보기온 %.0f~%.0f℃", forecast.slot().firstForecastHour(), low, high);
    }

    // 비: 강수형태가 비·비/눈·소나기인 시각, 또는 강수가 없는데 강수확률 60% 이상인 시각이 있으면 주의
    private Assessment rain(final List<Hour> hours) {
        List<Hour> matches = hours.stream().filter(hour -> valid(hour, PTY) && isRain(hour)).toList();
        if (!matches.isEmpty()) {
            return result(RAIN, CAUTION, "PRECIPITATION_TYPE", time(matches.getFirst()) + "비 예보가 있어요. 우산을 준비하세요", matches);
        }
        if (!allValid(hours, PTY)) {
            return unknown(RAIN, "VALUES_MISSING_OR_INVALID");
        }
        // 강수형태는 없음인데 강수량이 있으면 해석이 엇갈리므로, 양만으로 비라고 판단하지 않는다.
        if (hours.stream().anyMatch(hour -> valid(hour, PCP) && hour.value(PCP) > 0 && hour.value(PTY) == 0)) {
            return unknown(RAIN, "PRECIPITATION_TYPE_CONFLICT");
        }
        // POP는 강수확률이다. 눈 예보의 높은 POP를 비 예보로 중복 분류하지 않도록 강수가 전혀 없는 시각만 본다.
        List<Hour> probability = hours.stream().filter(hour -> allValid(List.of(hour), PTY, POP, PCP, SNO))
                .filter(this::noPrecipitation).filter(hour -> hour.value(POP) >= 60).toList();
        if (!probability.isEmpty()) {
            Hour first = probability.getFirst();
            return result(RAIN, CAUTION, "PROBABILITY_THRESHOLD", time(first)
                    + String.format(Locale.ROOT, "예보 강수확률 %.0f%%, 우산을 준비하세요", first.value(POP)), probability);
        }
        return allValid(hours, PTY, POP, PCP, SNO)
                ? result(RAIN, NOT_APPLICABLE, "BELOW_THRESHOLD", "주의 기준에 해당하지 않아요", List.of())
                : unknown(RAIN, "VALUES_MISSING_OR_INVALID");
    }

    // 눈: 강수형태가 비/눈·눈인 시각이 있으면 주의
    private Assessment snow(final List<Hour> hours) {
        List<Hour> matches = hours.stream().filter(hour -> valid(hour, PTY) && isSnow(hour)).toList();
        if (!matches.isEmpty()) {
            return result(SNOW, CAUTION, "PRECIPITATION_TYPE", time(matches.getFirst()) + "눈 예보가 있어요. 이동에 주의하세요", matches);
        }
        if (!allValid(hours, PTY)) {
            return unknown(SNOW, "VALUES_MISSING_OR_INVALID");
        }
        // 강수형태에 눈이 없는데 적설이 있으면 해석이 엇갈리므로 판단하지 않는다.
        if (hours.stream().anyMatch(hour -> valid(hour, SNO) && hour.value(SNO) > 0)) {
            return unknown(SNOW, "PRECIPITATION_TYPE_CONFLICT");
        }
        return allValid(hours, PTY, SNO)
                ? result(SNOW, NOT_APPLICABLE, "BELOW_THRESHOLD", "주의 기준에 해당하지 않아요", List.of())
                : unknown(SNOW, "VALUES_MISSING_OR_INVALID");
    }

    // 한파: 시간별 기온 또는 일 최저기온이 -5℃ 이하이면 주의
    private Assessment freeze(final List<Hour> hours, final Double minimum) {
        List<Hour> cold = hours.stream().filter(hour -> valid(hour, TMP) && hour.value(TMP) <= -5).toList();
        if (!cold.isEmpty() || validTemperature(minimum) && minimum <= -5) {
            return result(FREEZE, CAUTION, "TEMPERATURE_AT_MOST_MINUS_FIVE",
                    "추위 예보가 있어요. 노출된 수도관 보온을 점검하세요", cold);
        }
        return allValid(hours, TMP) && validTemperature(minimum)
                ? result(FREEZE, NOT_APPLICABLE, "BELOW_THRESHOLD", "수도관 보온 안내 기준에 해당하지 않아요", List.of())
                : unknown(FREEZE, "VALUES_MISSING_OR_INVALID");
    }

    // 일교차: 일 최고기온 - 최저기온이 10℃ 이상이면 주의
    private Assessment swing(final LifeWeatherForecast forecast) {
        Double low = forecast.minimum();
        Double high = forecast.maximum();
        if (!validTemperature(low) || !validTemperature(high) || low > high) {
            return unknown(TEMPERATURE_SWING, "DAILY_TEMPERATURES_MISSING_OR_INVALID");
        }
        boolean wide = high - low >= 10;
        return result(TEMPERATURE_SWING, wide ? CAUTION : NOT_APPLICABLE, "DAILY_RANGE",
                wide ? "일교차가 10℃ 이상이에요. 겉옷을 준비하세요" : "일교차 주의 기준에 해당하지 않아요", List.of());
    }

    // 건조: 습도 35% 이하인 시각이 있으면 주의
    private Assessment dry(final List<Hour> hours) {
        List<Hour> dry = hours.stream().filter(hour -> valid(hour, REH) && hour.value(REH) <= 35).toList();
        if (!dry.isEmpty()) {
            return result(DRY, CAUTION, "HUMIDITY_AT_MOST_35", time(dry.getFirst()) + "건조한 예보가 있어요. 실내 습도를 확인하세요", dry);
        }
        return allValid(hours, REH) ? result(DRY, NOT_APPLICABLE, "BELOW_THRESHOLD", "건조 안내 기준에 해당하지 않아요", List.of())
                : unknown(DRY, "VALUES_MISSING_OR_INVALID");
    }

    // 빨래: 09~18시(10개 시각) 모두 강수 없음·강수확률 30% 이하·습도 60% 이하·풍속 1~7m/s면 추천
    private Assessment laundry(final List<Hour> hours) {
        List<Hour> daytime = between(hours, 9, 18);
        if (daytime.stream().anyMatch(hour -> valid(hour, PTY) && hour.value(PTY) != 0)) {
            return result(LAUNDRY, CAUTION, "DAYTIME_PRECIPITATION", "낮에 강수 예보가 있어요. 실내 건조를 고려하세요", daytime);
        }
        if (daytime.size() != 10 || !allValid(daytime, PTY, POP, PCP, SNO, REH, WSD)) {
            return unknown(LAUNDRY, "VALUES_MISSING_OR_INVALID");
        }
        boolean favorable = daytime.stream().allMatch(hour -> noPrecipitation(hour) && hour.value(POP) <= 30
                && hour.value(REH) <= 60 && hour.value(WSD) >= 1 && hour.value(WSD) <= 7);
        return result(LAUNDRY, favorable ? RECOMMENDED : NOT_APPLICABLE, "DAYTIME_DRYING_CONDITIONS",
                favorable ? "09~18시 예보상 바깥 건조를 고려할 수 있어요" : "바깥 건조 추천 기준에 해당하지 않아요", favorable ? daytime : List.of());
    }

    // 환기: 10~17시(8개 시각) 중 강수 없음·습도 40~70%·풍속 5m/s 이하·기온 5~28℃인 시각이 있으면 추천
    // 공기질 자료는 없으므로 날씨만으로 판단하고, 공기질 확인을 문구로 안내한다.
    private Assessment ventilation(final List<Hour> hours) {
        List<Hour> daytime = between(hours, 10, 17);
        Predicate<Hour> usable = hour -> allValid(List.of(hour), PTY, PCP, SNO, REH, WSD, TMP);
        List<Hour> favorable = daytime.stream().filter(usable).filter(hour -> noPrecipitation(hour)
                && hour.value(REH) >= 40 && hour.value(REH) <= 70 && hour.value(WSD) <= 5
                && hour.value(TMP) >= 5 && hour.value(TMP) <= 28).toList();
        if (!favorable.isEmpty()) {
            return result(VENTILATION, RECOMMENDED, "WEATHER_ONLY_AIR_QUALITY_UNKNOWN",
                    time(favorable.getFirst()) + "실외 공기질을 확인한 뒤 짧은 환기를 고려하세요", favorable);
        }
        return daytime.size() == 8 && daytime.stream().allMatch(usable)
                ? result(VENTILATION, NOT_APPLICABLE, "WEATHER_ONLY", "날씨 기준 환기 추천 시간대가 없어요", List.of())
                : unknown(VENTILATION, "VALUES_MISSING_OR_INVALID");
    }

    // PTY(강수형태) 코드: 0 없음, 1 비, 2 비/눈, 3 눈, 4 소나기
    private boolean isRain(final Hour hour) {
        double pty = hour.value(PTY);
        return pty == 1 || pty == 2 || pty == 4;
    }

    private boolean isSnow(final Hour hour) {
        double pty = hour.value(PTY);
        return pty == 2 || pty == 3;
    }

    private boolean noPrecipitation(final Hour hour) {
        return hour.value(PTY) == 0 && hour.value(PCP) == 0 && hour.value(SNO) == 0;
    }

    private List<Hour> between(final List<Hour> hours, final int fromHour, final int toHour) {
        return hours.stream().filter(hour -> hour.at().getHour() >= fromHour && hour.at().getHour() <= toHour).toList();
    }

    private boolean allValid(final List<Hour> hours, final WeatherElement... elements) {
        return allValid(hours, List.of(elements));
    }

    private boolean allValid(final List<Hour> hours, final List<WeatherElement> elements) {
        return !hours.isEmpty() && hours.stream().allMatch(hour -> elements.stream().allMatch(element -> valid(hour, element)));
    }

    // 값이 없거나(null) 요소별 정상 범위를 벗어나면 판단에 쓰지 않는다.
    private boolean valid(final Hour hour, final WeatherElement element) {
        Double value = hour.value(element);
        return switch (element) {
            case TMP -> validTemperature(value);
            case PTY -> finiteBetween(value, 0, 4) && value == Math.rint(value);
            case POP, REH -> finiteBetween(value, 0, 100);
            case PCP, SNO -> finiteBetween(value, 0, 10000);
            case WSD -> finiteBetween(value, 0, 100);
            default -> false;
        };
    }

    private boolean validTemperature(final Double value) {
        return finiteBetween(value, -80, 60);
    }

    private boolean finiteBetween(final Double value, final double low, final double high) {
        return value != null && Double.isFinite(value) && value >= low && value <= high;
    }

    private String time(final Hour hour) {
        return String.format(Locale.ROOT, "%02d시 ", hour.at().getHour());
    }

    private Assessment unknown(final Condition type, final String reason) {
        return result(type, UNKNOWN, reason, "자료가 부족하거나 해석이 확인되지 않아 판단할 수 없어요", List.of());
    }

    private Assessment result(final Condition type, final Verdict verdict, final String reason,
                              final String message, final List<Hour> hours) {
        return new Assessment(type, verdict, reason, message, hours.stream().map(Hour::at).toList());
    }
}
