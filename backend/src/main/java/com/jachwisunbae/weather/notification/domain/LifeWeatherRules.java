package com.jachwisunbae.weather.notification.domain;

import static com.jachwisunbae.weather.domain.WeatherElement.PCP;
import static com.jachwisunbae.weather.domain.WeatherElement.POP;
import static com.jachwisunbae.weather.domain.WeatherElement.PTY;
import static com.jachwisunbae.weather.domain.WeatherElement.REH;
import static com.jachwisunbae.weather.domain.WeatherElement.SNO;
import static com.jachwisunbae.weather.domain.WeatherElement.TMP;
import static com.jachwisunbae.weather.domain.WeatherElement.WSD;
import static com.jachwisunbae.weather.notification.domain.LifeWeatherReport.Condition.DRY;
import static com.jachwisunbae.weather.notification.domain.LifeWeatherReport.Condition.FREEZE;
import static com.jachwisunbae.weather.notification.domain.LifeWeatherReport.Condition.LAUNDRY;
import static com.jachwisunbae.weather.notification.domain.LifeWeatherReport.Condition.RAIN;
import static com.jachwisunbae.weather.notification.domain.LifeWeatherReport.Condition.SNOW;
import static com.jachwisunbae.weather.notification.domain.LifeWeatherReport.Condition.TEMPERATURE_SWING;
import static com.jachwisunbae.weather.notification.domain.LifeWeatherReport.Condition.VENTILATION;
import static com.jachwisunbae.weather.notification.domain.LifeWeatherReport.Verdict.CAUTION;
import static com.jachwisunbae.weather.notification.domain.LifeWeatherReport.Verdict.NOT_APPLICABLE;
import static com.jachwisunbae.weather.notification.domain.LifeWeatherReport.Verdict.RECOMMENDED;
import static com.jachwisunbae.weather.notification.domain.LifeWeatherReport.Verdict.UNKNOWN;

import com.jachwisunbae.weather.domain.WeatherElement;
import com.jachwisunbae.weather.notification.domain.LifeWeatherForecast.Hour;
import com.jachwisunbae.weather.notification.domain.LifeWeatherReport.Assessment;
import com.jachwisunbae.weather.notification.domain.LifeWeatherReport.Condition;
import com.jachwisunbae.weather.notification.domain.LifeWeatherReport.Verdict;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.function.Predicate;
import java.util.stream.IntStream;

// 공식 기상특보가 아닌 초기 생활 안내 정책이다. 임계값과 적용 범위는 가이드의 v1 정책으로 관리한다.
public final class LifeWeatherRules {
    public static final String VERSION = "life-weather-v1";
    private static final List<Condition> PRIORITY = List.of(SNOW, RAIN, FREEZE, TEMPERATURE_SWING, DRY, LAUNDRY, VENTILATION);
    private final boolean precipitationContractVerified;

    public LifeWeatherRules(final boolean precipitationContractVerified) {
        this.precipitationContractVerified = precipitationContractVerified;
    }

    public LifeWeatherReport evaluate(final LifeWeatherForecast forecast) {
        List<Hour> hours = forecast.hours().stream().sorted(Comparator.comparing(Hour::at)).toList();
        List<LocalDateTime> expected = IntStream.range(forecast.slot().firstForecastHour(), 24)
                .mapToObj(hour -> forecast.date().atTime(hour, 0)).toList();
        if (!forecast.sourceVerified() || !hours.stream().map(Hour::at).toList().equals(expected)) {
            return new LifeWeatherReport(false, "FORECAST_NOT_READY", null, null,
                    PRIORITY.stream().map(type -> unknown(type, "FORECAST_NOT_READY")).toList());
        }
        List<Assessment> results = List.of(precipitation(hours, false), precipitation(hours, true),
                freeze(hours, forecast.minimum()), swing(forecast), dry(hours), laundry(hours), ventilation(hours));
        boolean sendable = allValid(hours, TMP, PTY);
        if (!sendable) {
            return new LifeWeatherReport(false, "ESSENTIAL_VALUES_MISSING", null, null, results);
        }
        List<Assessment> cautions = results.stream().filter(value -> value.verdict() == CAUTION)
                .sorted(Comparator.comparingInt(value -> PRIORITY.indexOf(value.condition()))).toList();
        String prefix = forecast.slot() == NotificationSlot.MORNING ? "오늘 " : "내일 ";
        String title;
        String body = "마지막으로 확인한 위치 기준이에요. 상세 날씨를 확인해 주세요.";
        if (!cautions.isEmpty()) {
            title = prefix + cautions.getFirst().message();
            if (cautions.size() > 1) {
                body = prefix + cautions.get(1).message();
            }
        } else {
            Assessment recommendation = results.stream().filter(value -> value.verdict() == RECOMMENDED).findFirst().orElse(null);
            if (recommendation != null) {
                title = prefix + recommendation.message();
            } else {
                double low = hours.stream().mapToDouble(hour -> hour.value(TMP)).min().orElseThrow();
                double high = hours.stream().mapToDouble(hour -> hour.value(TMP)).max().orElseThrow();
                title = prefix + String.format(Locale.ROOT, "%02d~23시 예보기온 %.0f~%.0f℃", forecast.slot().firstForecastHour(), low, high);
                if (results.stream().anyMatch(value -> value.verdict() == UNKNOWN)) {
                    body = "판단할 수 없는 생활 날씨 항목이 있어요. 상세 내용을 확인해 주세요.";
                }
            }
        }
        return new LifeWeatherReport(true, "READY", title, body, results);
    }

    private Assessment precipitation(final List<Hour> hours, final boolean snow) {
        Condition type = snow ? SNOW : RAIN;
        List<Hour> matches = hours.stream().filter(hour -> valid(hour, PTY))
                .filter(hour -> snow ? hour.value(PTY) == 2 || hour.value(PTY) == 3
                        : hour.value(PTY) == 1 || hour.value(PTY) == 2 || hour.value(PTY) == 4).toList();
        if (!matches.isEmpty()) {
            return result(type, CAUTION, "PRECIPITATION_TYPE", time(matches.getFirst())
                    + (snow ? "눈 예보가 있어요. 이동에 주의하세요" : "비 예보가 있어요. 우산을 준비하세요"), matches);
        }
        if (!precipitationContractVerified) {
            return unknown(type, "PRECIPITATION_CONTRACT_UNVERIFIED");
        }
        WeatherElement amount = snow ? SNO : PCP;
        List<Hour> amounts = hours.stream().filter(hour -> valid(hour, amount) && hour.value(amount) > 0).toList();
        if (!amounts.isEmpty()) {
            return result(type, CAUTION, "PRECIPITATION_PRESENT", time(amounts.getFirst())
                    + (snow ? "적설 예보가 있어요. 이동에 주의하세요" : "강수 예보가 있어요. 우산을 준비하세요"), amounts);
        }
        if (!snow) {
            List<Hour> probability = hours.stream().filter(hour -> valid(hour, POP) && hour.value(POP) >= 60).toList();
            if (!probability.isEmpty()) {
                Hour first = probability.getFirst();
                return result(type, CAUTION, "PROBABILITY_THRESHOLD", time(first)
                        + String.format(Locale.ROOT, "예보 강수확률 %.0f%%, 우산을 준비하세요", first.value(POP)), probability);
            }
        }
        return allValid(hours, snow ? List.of(PTY, SNO) : List.of(PTY, POP, PCP))
                ? result(type, NOT_APPLICABLE, "BELOW_THRESHOLD", "주의 기준에 해당하지 않아요", List.of())
                : unknown(type, "VALUES_MISSING_OR_INVALID");
    }

    private Assessment freeze(final List<Hour> hours, final Double minimum) {
        List<Hour> cold = hours.stream().filter(hour -> valid(hour, TMP) && hour.value(TMP) <= -5).toList();
        if (!cold.isEmpty() || finiteBetween(minimum, -80, 60) && minimum <= -5) {
            return result(FREEZE, CAUTION, "TEMPERATURE_AT_MOST_MINUS_FIVE",
                    "추위 예보가 있어요. 노출된 수도관 보온을 점검하세요", cold);
        }
        return allValid(hours, TMP) && finiteBetween(minimum, -80, 60)
                ? result(FREEZE, NOT_APPLICABLE, "BELOW_THRESHOLD", "수도관 보온 안내 기준에 해당하지 않아요", List.of())
                : unknown(FREEZE, "VALUES_MISSING_OR_INVALID");
    }

    private Assessment swing(final LifeWeatherForecast forecast) {
        Double low = forecast.minimum();
        Double high = forecast.maximum();
        if (!finiteBetween(low, -80, 60) || !finiteBetween(high, -80, 60) || low > high) {
            return unknown(TEMPERATURE_SWING, "DAILY_TEMPERATURES_MISSING_OR_INVALID");
        }
        return result(TEMPERATURE_SWING, high - low >= 10 ? CAUTION : NOT_APPLICABLE, "DAILY_RANGE",
                high - low >= 10 ? "일교차가 10℃ 이상이에요. 겉옷을 준비하세요" : "일교차 주의 기준에 해당하지 않아요", List.of());
    }

    private Assessment dry(final List<Hour> hours) {
        List<Hour> dry = hours.stream().filter(hour -> valid(hour, REH) && hour.value(REH) <= 35).toList();
        if (!dry.isEmpty()) {
            return result(DRY, CAUTION, "HUMIDITY_AT_MOST_35", time(dry.getFirst()) + "건조한 예보가 있어요. 실내 습도를 확인하세요", dry);
        }
        return allValid(hours, REH) ? result(DRY, NOT_APPLICABLE, "BELOW_THRESHOLD", "건조 안내 기준에 해당하지 않아요", List.of())
                : unknown(DRY, "VALUES_MISSING_OR_INVALID");
    }

    private Assessment laundry(final List<Hour> hours) {
        List<Hour> daytime = hours.stream().filter(hour -> hour.at().getHour() >= 9 && hour.at().getHour() <= 18).toList();
        if (daytime.stream().anyMatch(hour -> valid(hour, PTY) && hour.value(PTY) != 0)) {
            return result(LAUNDRY, CAUTION, "DAYTIME_PRECIPITATION", "낮에 강수 예보가 있어요. 실내 건조를 고려하세요", daytime);
        }
        if (!precipitationContractVerified) {
            return unknown(LAUNDRY, "PRECIPITATION_CONTRACT_UNVERIFIED");
        }
        if (daytime.size() != 10 || !allValid(daytime, PTY, POP, PCP, SNO, REH, WSD)) {
            return unknown(LAUNDRY, "VALUES_MISSING_OR_INVALID");
        }
        boolean favorable = daytime.stream().allMatch(hour -> noPrecipitation(hour) && hour.value(POP) <= 30
                && hour.value(REH) <= 60 && hour.value(WSD) >= 1 && hour.value(WSD) <= 7);
        return result(LAUNDRY, favorable ? RECOMMENDED : NOT_APPLICABLE, "DAYTIME_DRYING_CONDITIONS",
                favorable ? "09~18시 예보상 바깥 건조를 고려할 수 있어요" : "바깥 건조 추천 기준에 해당하지 않아요", favorable ? daytime : List.of());
    }

    private Assessment ventilation(final List<Hour> hours) {
        if (!precipitationContractVerified) {
            return unknown(VENTILATION, "PRECIPITATION_CONTRACT_UNVERIFIED");
        }
        List<Hour> daytime = hours.stream().filter(hour -> hour.at().getHour() >= 10 && hour.at().getHour() <= 17).toList();
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

    private boolean noPrecipitation(final Hour hour) {
        return hour.value(PTY) == 0 && hour.value(PCP) == 0 && hour.value(SNO) == 0;
    }

    private boolean allValid(final List<Hour> hours, final WeatherElement... elements) {
        return allValid(hours, List.of(elements));
    }

    private boolean allValid(final List<Hour> hours, final List<WeatherElement> elements) {
        return !hours.isEmpty() && hours.stream().allMatch(hour -> elements.stream().allMatch(element -> valid(hour, element)));
    }

    private boolean valid(final Hour hour, final WeatherElement element) {
        Double value = hour.value(element);
        return switch (element) {
            case TMP -> finiteBetween(value, -80, 60);
            case PTY -> finiteBetween(value, 0, 4) && value == Math.rint(value);
            case POP, REH -> finiteBetween(value, 0, 100);
            case PCP, SNO -> finiteBetween(value, 0, 10000);
            case WSD -> finiteBetween(value, 0, 100);
            default -> false;
        };
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
