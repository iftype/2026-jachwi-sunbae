package com.jachwisunbae.weather.notification.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.jachwisunbae.weather.domain.WeatherElement;
import com.jachwisunbae.weather.notification.domain.LifeWeatherForecast.Hour;
import com.jachwisunbae.weather.notification.domain.LifeWeatherReport.Assessment;
import com.jachwisunbae.weather.notification.domain.LifeWeatherReport.Condition;
import com.jachwisunbae.weather.notification.domain.LifeWeatherReport.Verdict;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

class LifeWeatherRulesTest {
    private static final LocalDate DATE = LocalDate.of(2026, 10, 25);
    private final LifeWeatherRules verified = new LifeWeatherRules(true);

    @Test
    void unverifiedRawSemanticsNeverTurnZeroIntoDryWeatherRecommendation() {
        var report = new LifeWeatherRules(false).evaluate(forecast(hours(), 10.0, 18.0));
        assertThat(report.sendable()).isTrue();
        for (Condition type : List.of(Condition.RAIN, Condition.SNOW, Condition.LAUNDRY, Condition.VENTILATION)) {
            assertThat(assessment(report, type).verdict()).isEqualTo(Verdict.UNKNOWN);
        }
        assertThat(report.title()).contains("오늘 07~23시 예보기온");
        assertThat(report.body()).contains("판단할 수 없는");
    }

    @ParameterizedTest
    @CsvSource({"0,false,false", "1,true,false", "2,true,true", "3,false,true", "4,true,false"})
    void precipitationTypeIsDistinctFromProbabilityAndAmount(final double pty, final boolean rain, final boolean snow) {
        var report = new LifeWeatherRules(false).evaluate(forecast(change(hours(), 15, WeatherElement.PTY, pty), 10.0, 18.0));
        assertThat(assessment(report, Condition.RAIN).verdict() == Verdict.CAUTION).isEqualTo(rain);
        assertThat(assessment(report, Condition.SNOW).verdict() == Verdict.CAUTION).isEqualTo(snow);
        assertThat(report.sendable()).isTrue();
    }

    @ParameterizedTest
    @CsvSource({"59.9,NOT_APPLICABLE", "60,CAUTION", "100,CAUTION", "101,UNKNOWN", "-1,UNKNOWN"})
    void probabilityThresholdRequiresVerifiedContractAndStatesTargetHour(final double pop, final Verdict expected) {
        var report = verified.evaluate(forecast(change(hours(), 15, WeatherElement.POP, pop), 10.0, 18.0));
        var rain = assessment(report, Condition.RAIN);
        assertThat(rain.verdict()).isEqualTo(expected);
        if (expected == Verdict.CAUTION) {
            assertThat(rain.message()).contains("15시 예보 강수확률").doesNotContain("전체");
            assertThat(rain.forecastTimes()).containsExactly(DATE.atTime(15, 0));
        }
    }

    @ParameterizedTest
    @CsvSource({"PCP,RAIN", "SNO,SNOW"})
    void positiveAmountsAndActualZeroAreDifferentFromMissing(final WeatherElement element, final Condition condition) {
        assertThat(assessment(verified.evaluate(forecast(change(hours(), 15, element, 0.1), 10.0, 18.0)), condition).verdict())
                .isEqualTo(Verdict.CAUTION);
        assertThat(assessment(verified.evaluate(forecast(hours(), 10.0, 18.0)), condition).verdict())
                .isEqualTo(Verdict.NOT_APPLICABLE);
        assertThat(assessment(verified.evaluate(forecast(change(hours(), 15, element, null), 10.0, 18.0)), condition).verdict())
                .isEqualTo(Verdict.UNKNOWN);
    }

    @ParameterizedTest
    @CsvSource({"-5,CAUTION", "-4.9,NOT_APPLICABLE"})
    void pipePrecautionUsesTemperatureBoundaryWithoutPredictingActualDamage(final double tmp, final Verdict expected) {
        var report = verified.evaluate(forecast(change(hours(), 7, WeatherElement.TMP, tmp), 10.0, 18.0));
        assertThat(assessment(report, Condition.FREEZE).verdict()).isEqualTo(expected);
        if (expected == Verdict.CAUTION) {
            assertThat(assessment(report, Condition.FREEZE).message()).contains("보온을 점검").doesNotContain("동파됩니다");
        }
    }

    @Test
    void dailyMinimumCanTriggerPrecautionAndMissingDailyTemperaturesStayUnknown() {
        assertThat(assessment(verified.evaluate(forecast(hours(), -5.0, 3.0)), Condition.FREEZE).verdict()).isEqualTo(Verdict.CAUTION);
        var missing = verified.evaluate(forecast(hours(), null, null));
        assertThat(assessment(missing, Condition.FREEZE).verdict()).isEqualTo(Verdict.UNKNOWN);
        assertThat(assessment(missing, Condition.TEMPERATURE_SWING).verdict()).isEqualTo(Verdict.UNKNOWN);
        assertThat(assessment(verified.evaluate(forecast(hours(), 20.0, 10.0)), Condition.TEMPERATURE_SWING).verdict()).isEqualTo(Verdict.UNKNOWN);
    }

    @ParameterizedTest
    @CsvSource({"19.9,NOT_APPLICABLE", "20,CAUTION"})
    void dailyRangeUsesTrueDailyMinAndMax(final double maximum, final Verdict expected) {
        assertThat(assessment(verified.evaluate(forecast(hours(), 10.0, maximum)), Condition.TEMPERATURE_SWING).verdict()).isEqualTo(expected);
    }

    @ParameterizedTest
    @CsvSource({"35,CAUTION", "35.1,NOT_APPLICABLE", "0,CAUTION", "101,UNKNOWN"})
    void dryConditionsUseHumidityBoundary(final double reh, final Verdict expected) {
        assertThat(assessment(verified.evaluate(forecast(change(hours(), 8, WeatherElement.REH, reh), 10.0, 18.0)), Condition.DRY).verdict())
                .isEqualTo(expected);
    }

    @Test
    void laundryUsesEntireDaytimeWindowAndIgnoresNightRainForRecommendation() {
        var good = verified.evaluate(forecast(change(hours(), 23, WeatherElement.PTY, 1.0), 10.0, 18.0));
        assertThat(assessment(good, Condition.LAUNDRY).verdict()).isEqualTo(Verdict.RECOMMENDED);
        var missing = verified.evaluate(forecast(change(hours(), 9, WeatherElement.REH, null), 10.0, 18.0));
        assertThat(assessment(missing, Condition.LAUNDRY).verdict()).isEqualTo(Verdict.UNKNOWN);
        var windy = verified.evaluate(forecast(change(hours(), 18, WeatherElement.WSD, 7.1), 10.0, 18.0));
        assertThat(assessment(windy, Condition.LAUNDRY).verdict()).isEqualTo(Verdict.NOT_APPLICABLE);
    }

    @Test
    void ventilationReportsSpecificUsableHoursWithoutPromisingCleanAir() {
        var report = verified.evaluate(forecast(hours(), 10.0, 18.0));
        var ventilation = assessment(report, Condition.VENTILATION);
        assertThat(ventilation.verdict()).isEqualTo(Verdict.RECOMMENDED);
        assertThat(ventilation.forecastTimes()).hasSize(8).startsWith(DATE.atTime(10, 0)).endsWith(DATE.atTime(17, 0));
        assertThat(ventilation.message()).contains("실외 공기질을 확인");
    }

    @Test
    void importantWarningsWinAndPushContainsAtMostTwoConditions() {
        var values = change(hours(), 15, WeatherElement.PTY, 2.0);
        values = change(values, 7, WeatherElement.TMP, -5.0);
        values = change(values, 8, WeatherElement.REH, 20.0);
        var report = verified.evaluate(forecast(values, -5.0, 20.0));
        assertThat(report.assessments()).hasSize(7);
        assertThat(report.title()).contains("눈");
        assertThat(report.body()).contains("우산").doesNotContain("보온", "건조", "겉옷");
    }

    @Test
    void unavailableSourceOrMissingHourNeverCreatesNormalPush() {
        var complete = forecast(hours(), 10.0, 18.0);
        var incomplete = verified.evaluate(new LifeWeatherForecast(DATE, NotificationSlot.MORNING,
                complete.hours(), 10.0, 18.0, false));
        assertThat(incomplete.sendable()).isFalse();
        assertThat(incomplete.assessments()).allMatch(value -> value.verdict() == Verdict.UNKNOWN);
        assertThat(verified.evaluate(forecast(hours().subList(1, 17), 10.0, 18.0)).sendable()).isFalse();
        var duplicate = new ArrayList<>(hours());
        duplicate.set(0, duplicate.get(1));
        assertThat(verified.evaluate(forecast(duplicate, 10.0, 18.0)).sendable()).isFalse();
    }

    @ParameterizedTest
    @ValueSource(doubles = {Double.NaN, Double.POSITIVE_INFINITY, -81, 61})
    void invalidEssentialTemperaturePreventsSend(final double value) {
        assertThat(verified.evaluate(forecast(change(hours(), 7, WeatherElement.TMP, value), 10.0, 18.0)).sendable()).isFalse();
    }

    @Test
    void missingEssentialValueAndUnknownPrecipitationCodePreventSend() {
        assertThat(verified.evaluate(forecast(change(hours(), 7, WeatherElement.TMP, null), 10.0, 18.0)).sendable()).isFalse();
        for (double value : List.of(0.5, 5.0, -1.0)) {
            assertThat(verified.evaluate(forecast(change(hours(), 7, WeatherElement.PTY, value), 10.0, 18.0)).sendable()).isFalse();
        }
    }

    @Test
    void eveningIncludesTomorrowMidnightAndMorningStartsAtSeven() {
        var tomorrow = DATE.plusDays(1);
        var hours = IntStream.range(0, 24).mapToObj(hour -> new Hour(tomorrow.atTime(hour, 0), values())).toList();
        hours = change(hours, 0, WeatherElement.PTY, 1.0);
        var report = verified.evaluate(new LifeWeatherForecast(tomorrow, NotificationSlot.EVENING, hours, 10.0, 18.0, true));
        assertThat(report.title()).startsWith("내일 00시");
        assertThat(report.sendable()).isTrue();
    }

    @Test
    void savedRawSampleDoesNotJustifyProbabilityOrAmountInterpretation() throws Exception {
        Map<WeatherElement, Double> raw = new EnumMap<>(WeatherElement.class);
        try (var reader = new BufferedReader(new InputStreamReader(getClass().getResourceAsStream(
                "/weather/kma-grid-samples.csv"), StandardCharsets.UTF_8))) {
            reader.lines().skip(1).map(line -> line.split(","))
                    .filter(row -> row[4].equals("60") && row[5].equals("127"))
                    .forEach(row -> raw.put(WeatherElement.valueOf(row[0]), Double.valueOf(row[6])));
        }
        assertThat(raw).containsEntry(WeatherElement.TMP, 10.0).containsEntry(WeatherElement.PTY, 0.0)
                .containsEntry(WeatherElement.POP, 0.0).containsEntry(WeatherElement.REH, 65.0);
        // 실제 2026-10-22 20시 값 한 세트를 합성 시간대에 배치한다. 하루 실측 자료 검증을 뜻하지 않는다.
        var syntheticWindow = IntStream.range(7, 24).mapToObj(hour -> new Hour(DATE.atTime(hour, 0), raw)).toList();
        var report = new LifeWeatherRules(false).evaluate(forecast(syntheticWindow, null, null));
        assertThat(report.sendable()).isTrue();
        assertThat(assessment(report, Condition.RAIN).verdict()).isEqualTo(Verdict.UNKNOWN);
        assertThat(assessment(report, Condition.LAUNDRY).verdict()).isEqualTo(Verdict.UNKNOWN);
        assertThat(report.title()).contains("10~10℃").doesNotContain("강수확률");
    }

    private LifeWeatherForecast forecast(final List<Hour> hours, final Double low, final Double high) {
        return new LifeWeatherForecast(DATE, NotificationSlot.MORNING, hours, low, high, true);
    }

    private List<Hour> hours() {
        return IntStream.range(7, 24).mapToObj(hour -> new Hour(DATE.atTime(hour, 0), values())).toList();
    }

    private Map<WeatherElement, Double> values() {
        return Map.of(WeatherElement.TMP, 15.0, WeatherElement.PTY, 0.0, WeatherElement.POP, 0.0,
                WeatherElement.PCP, 0.0, WeatherElement.SNO, 0.0, WeatherElement.REH, 55.0, WeatherElement.WSD, 2.0);
    }

    private List<Hour> change(final List<Hour> hours, final int at, final WeatherElement element, final Double value) {
        return hours.stream().map(hour -> {
            var values = new EnumMap<>(hour.values());
            if (hour.at().getHour() == at) {
                values.put(element, value);
            }
            return new Hour(hour.at(), values);
        }).toList();
    }

    private Assessment assessment(final LifeWeatherReport report, final Condition condition) {
        return report.assessments().stream().filter(value -> value.condition() == condition).findFirst().orElseThrow();
    }
}
