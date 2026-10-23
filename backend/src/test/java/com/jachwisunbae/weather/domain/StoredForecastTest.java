package com.jachwisunbae.weather.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

class StoredForecastTest {

    private static final GridPoint POINT = new GridPoint(60, 127);
    private static final ForecastTimes TIMES = new ForecastTimes(LocalDateTime.of(2026, 10, 22, 23, 0),
            LocalDateTime.of(2026, 10, 23, 0, 0));
    private static final LocalDateTime COLLECTED_AT = TIMES.publishedAt().plusMinutes(15);
    private static final LocalDate DATE = LocalDate.of(2026, 10, 23);

    @Test
    @DisplayName("저장 모델은 음수·소수·0·NULL을 보존한다")
    void preservesRawValues() {
        HourlyForecast hourly = new HourlyForecast(POINT, TIMES, -7.25, 1.0, 0.0, 30.0,
                0.0, null, 65.0, 0.7, COLLECTED_AT);
        DailyTemperature missing = new DailyTemperature(null, TIMES.publishedAt(), COLLECTED_AT);
        DailyTemperature zero = new DailyTemperature(0.0, TIMES.publishedAt(), COLLECTED_AT);

        assertThat(hourly.tmp()).isEqualTo(-7.25);
        assertThat(hourly.wsd()).isEqualTo(0.7);
        assertThat(hourly.pty()).isZero();
        assertThat(hourly.sno()).isNull();
        assertThat(new DailyForecast(POINT, DATE, missing, null).tmn()).isEqualTo(missing);
        assertThat(new DailyForecast(POINT, DATE, missing, null).tmx()).isNull();
        assertThat(new DailyForecast(POINT, DATE, null, zero).tmx().value()).isZero();
    }

    @ParameterizedTest
    @MethodSource("invalidHourlyValues")
    @DisplayName("시간별 모든 요소에서 원본 결측 코드와 비정상 숫자를 거부한다")
    void rejectsInvalidHourlyValues(final int index, final double invalid) {
        Double[] values = new Double[8];
        values[index] = invalid;

        assertThatThrownBy(() -> new HourlyForecast(POINT, TIMES,
                values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], COLLECTED_AT))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @ValueSource(doubles = {-99, -999, Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY})
    @DisplayName("일별 기온에서도 원본 결측 코드와 비정상 숫자를 거부한다")
    void rejectsInvalidDailyValues(final double invalid) {
        assertThatThrownBy(() -> new DailyTemperature(invalid, TIMES.publishedAt(), COLLECTED_AT))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("시간별 예보는 격자·요청 시각·수집 시각이 필요하다")
    void requiresHourlyMetadata() {
        assertThatThrownBy(() -> new HourlyForecast(null, TIMES,
                null, null, null, null, null, null, null, null, COLLECTED_AT))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new HourlyForecast(POINT, null,
                null, null, null, null, null, null, null, null, COLLECTED_AT))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new HourlyForecast(POINT, TIMES,
                null, null, null, null, null, null, null, null, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("일별 기온은 값이 결측이어도 발표·수집 시각이 필요하다")
    void requiresDailyTemperatureMetadata() {
        assertThatThrownBy(() -> new DailyTemperature(null, null, COLLECTED_AT))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new DailyTemperature(null, TIMES.publishedAt(), null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"2026-10-22T23:01:00", "2026-10-22T23:00:01", "2026-10-22T23:00:00.000000001"})
    @DisplayName("일별 기온의 발표시각도 정시여야 한다")
    void rejectsSubHourPublication(final String publishedAt) {
        assertThatThrownBy(() -> new DailyTemperature(1.0, LocalDateTime.parse(publishedAt), COLLECTED_AT))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("일별 예보는 격자·대상일과 하나 이상의 수집 결과가 필요하다")
    void requiresDailyMetadataAndAtLeastOneResult() {
        DailyTemperature temperature = new DailyTemperature(1.0, TIMES.publishedAt(), COLLECTED_AT);

        assertThatThrownBy(() -> new DailyForecast(null, DATE, temperature, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new DailyForecast(POINT, null, temperature, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new DailyForecast(POINT, DATE, null, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("TMN·TMX 중 어느 쪽도 대상일 이후에 발표된 값일 수 없다")
    void rejectsPublicationAfterForecastDate() {
        DailyTemperature later = new DailyTemperature(1.0, DATE.plusDays(1).atStartOfDay(), COLLECTED_AT);

        assertThatThrownBy(() -> new DailyForecast(POINT, DATE, later, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new DailyForecast(POINT, DATE, null, later))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static Stream<Arguments> invalidHourlyValues() {
        return IntStream.range(0, 8).boxed().flatMap(index ->
                Stream.of(-99.0, -999.0, Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY)
                        .map(value -> Arguments.of(index, value)));
    }
}
