package com.jachwisunbae.notification.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.jachwisunbae.notification.domain.LifeWeatherForecast.Hour;
import com.jachwisunbae.notification.domain.LifeWeatherReport.Condition;
import com.jachwisunbae.notification.domain.LifeWeatherReport.Notice;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.function.UnaryOperator;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

class LifeWeatherRulesTest {
    private static final LocalDate DATE = LocalDate.of(2026, 10, 25);
    private final LifeWeatherRules rules = new LifeWeatherRules();

    @ParameterizedTest
    @CsvSource({"0,false,false", "1,true,false", "2,true,true", "3,false,true", "4,true,false"})
    void precipitationUsesOnlyType(final double pty, final boolean rain, final boolean snow) {
        var report = evaluate(replace(hours(), 12, h -> new Hour(h.at(), h.temperature(), pty, h.humidity())), null, null);
        assertThat(has(report, Condition.RAIN)).isEqualTo(rain);
        assertThat(has(report, Condition.SNOW)).isEqualTo(snow);
    }

    @ParameterizedTest
    @CsvSource({"-5.1,true", "-5,true", "-4.9,false"})
    void hourlyColdBoundary(final double temperature, final boolean expected) {
        var report = evaluate(replace(hours(), 7, h -> new Hour(h.at(), temperature, 0.0, h.humidity())), null, null);
        assertThat(has(report, Condition.FREEZE)).isEqualTo(expected);
    }

    @ParameterizedTest
    @CsvSource({"-5.1,true", "-5,true", "-4.9,false", "NULL,false"})
    void dailyMinimumCanIndependentlyCreateColdNotice(final String minimum, final boolean expected) {
        var report = evaluate(hours(), number(minimum), null);
        assertThat(report.sendable()).isTrue();
        assertThat(has(report, Condition.FREEZE)).isEqualTo(expected);
        assertThat(has(report, Condition.TEMPERATURE_SWING)).isFalse();
    }

    @ParameterizedTest
    @CsvSource({"0,9.9,false", "0,10,true", "0,10.1,true", "NULL,20,false", "10,NULL,false",
            "20,10,false"})
    void dailyRangeRequiresValidDailyTemperatures(final String minimum, final String maximum, final boolean expected) {
        var report = evaluate(hours(), number(minimum), number(maximum));
        assertThat(report.sendable()).isTrue();
        assertThat(has(report, Condition.TEMPERATURE_SWING)).isEqualTo(expected);
    }

    @ParameterizedTest
    @CsvSource({"60,60,true", "60,61,false", "50,100,true", "61,61,false", "0,0,true"})
    void laundryUsesTheTenHourAverageRatherThanEveryHoursThreshold(final double humidity, final double noonHumidity,
            final boolean expected) {
        var hours = hours().stream().map(h -> new Hour(h.at(), h.temperature(), 0.0, humidity)).toList();
        var report = evaluate(replace(hours, 12, h -> new Hour(h.at(), h.temperature(), 0.0, noonHumidity)), null, null);
        assertThat(has(report, Condition.LAUNDRY)).isEqualTo(expected);
    }

    @ParameterizedTest
    @NullSource
    void missingDaytimeHumidityOnlyOmitsLaundry(final Double humidity) {
        var report = evaluate(replace(hours(), 9, h -> new Hour(h.at(), h.temperature(), 0.0, humidity)), null, null);
        assertThat(report.sendable()).isTrue();
        assertThat(report.notices()).isEmpty();
        assertThat(report.body()).contains("예보기온");
    }

    @ParameterizedTest
    @CsvSource({"8,true", "9,false", "18,false", "19,true"})
    void laundryChecksOnlyNineThroughEighteen(final int hour, final boolean expected) {
        var report = evaluate(replace(hours(), hour, h -> new Hour(h.at(), h.temperature(), 1.0, null)), null, null);
        assertThat(report.sendable()).isTrue();
        assertThat(has(report, Condition.LAUNDRY)).isEqualTo(expected);
    }

    @Test
    void noticesContainOnlyMatchesInMessagePriorityOrder() {
        var report = evaluate(replace(hours(), 20, h -> new Hour(h.at(), -5.0, 2.0, h.humidity())), -5.0, 5.0);
        assertThat(report.notices()).extracting(Notice::condition).containsExactly(
                Condition.SNOW, Condition.RAIN, Condition.FREEZE, Condition.TEMPERATURE_SWING, Condition.LAUNDRY);
        assertThat(report.title()).isEqualTo("자취선배 생활정보");
        assertThat(report.body()).isEqualTo("오늘 눈이 예상돼요. 이동할 때 주의하세요!");
    }

    @Test
    void cautionComesBeforeLaundryInBody() {
        var report = evaluate(hours(), -5.0, null);
        assertThat(report.notices()).extracting(Notice::condition).containsExactly(Condition.FREEZE, Condition.LAUNDRY);
        assertThat(report.body()).isEqualTo("오늘 영하 5℃ 이하 추위가 예상돼요. 수도관 보온을 점검하세요!");
    }

    @Test
    void laundryIsTheBodyWithoutCautions() {
        var report = evaluate(hours(), null, null);
        assertThat(report.notices()).extracting(Notice::condition).containsExactly(Condition.LAUNDRY);
        assertThat(report.body()).isEqualTo("오늘은 비 예보가 없고 습도가 낮아요. 빨래하기 괜찮겠어요!");
    }

    @ParameterizedTest
    @EnumSource(NotificationSlot.class)
    void noNoticeUsesTargetWindowTemperatures(final NotificationSlot slot) {
        LocalDate date = slot.targetDate(DATE);
        var hours = hours(date, slot).stream().map(h -> new Hour(h.at(), 15.0, 0.0, null)).toList();
        hours = replace(hours, slot.firstForecastHour(), h -> new Hour(h.at(), 5.0, 0.0, null));
        hours = replace(hours, 23, h -> new Hour(h.at(), 20.0, 0.0, null));
        var report = rules.evaluate(new LifeWeatherForecast(date, slot, hours, null, null));
        assertThat(report.sendable()).isTrue();
        assertThat(report.notices()).isEmpty();
        assertThat(report.body()).isEqualTo(slot == NotificationSlot.MORNING
                ? "오늘 07~23시 예보기온 5~20℃" : "내일 00~23시 예보기온 5~20℃");
    }

    @ParameterizedTest
    @CsvSource({"NULL,0", "15,NULL"})
    void anyInvalidEssentialValuePreventsTheWholeNotification(final String temperature, final String pty) {
        var hours = replace(hours(), 23, h -> new Hour(h.at(), number(temperature), number(pty), h.humidity()));
        assertUnsendable(evaluate(hours, -5.0, 10.0));
    }

    @ParameterizedTest
    @ValueSource(strings = {"missing", "duplicate", "wrong-date", "wrong-minute", "extra", "empty"})
    void incompleteWindowPreventsNotification(final String cause) {
        var hours = new ArrayList<>(hours());
        switch (cause) {
            case "missing" -> hours.removeFirst();
            case "duplicate" -> hours.set(0, hours.get(1));
            case "wrong-date" -> hours.set(0, new Hour(DATE.minusDays(1).atTime(7, 0), 15.0, 0.0, 55.0));
            case "wrong-minute" -> hours.set(0, new Hour(DATE.atTime(7, 1), 15.0, 0.0, 55.0));
            case "extra" -> hours.add(new Hour(DATE.atTime(6, 0), 15.0, 0.0, 55.0));
            case "empty" -> hours.clear();
            default -> throw new IllegalArgumentException();
        }
        assertUnsendable(rules.evaluate(new LifeWeatherForecast(DATE, NotificationSlot.MORNING, hours, null, null)));
    }

    @Test
    void inputOrderDoesNotChangeNotices() {
        var hours = new ArrayList<>(hours());
        Collections.reverse(hours);
        assertThat(evaluate(hours, null, null)).isEqualTo(evaluate(hours(), null, null));
    }

    private void assertUnsendable(final LifeWeatherReport report) {
        assertThat(report.sendable()).isFalse();
        assertThat(report.title()).isNull();
        assertThat(report.body()).isNull();
        assertThat(report.notices()).isEmpty();
    }

    private LifeWeatherReport evaluate(final List<Hour> hours, final Double minimum, final Double maximum) {
        return rules.evaluate(new LifeWeatherForecast(DATE, NotificationSlot.MORNING, hours, minimum, maximum));
    }

    private List<Hour> hours() { return hours(DATE, NotificationSlot.MORNING); }

    private List<Hour> hours(final LocalDate date, final NotificationSlot slot) {
        return IntStream.range(slot.firstForecastHour(), 24)
                .mapToObj(hour -> new Hour(date.atTime(hour, 0), 15.0, 0.0, 55.0)).toList();
    }

    private List<Hour> replace(final List<Hour> hours, final int hour, final UnaryOperator<Hour> change) {
        return hours.stream().map(h -> h.at().getHour() == hour ? change.apply(h) : h).toList();
    }

    private boolean has(final LifeWeatherReport report, final Condition condition) {
        return report.notices().stream().anyMatch(notice -> notice.condition() == condition);
    }

    private Double number(final String value) { return value.equals("NULL") ? null : Double.valueOf(value); }
}
