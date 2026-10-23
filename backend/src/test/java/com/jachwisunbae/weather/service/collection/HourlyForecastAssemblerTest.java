package com.jachwisunbae.weather.service.collection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.weather.domain.ForecastTimes;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.HourlyForecast;
import com.jachwisunbae.weather.domain.WeatherElement;
import com.jachwisunbae.weather.provider.kma.GridForecast;
import com.jachwisunbae.weather.provider.kma.GridValue;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;

class HourlyForecastAssemblerTest {

    private static final ForecastTimes TIMES = new ForecastTimes(LocalDateTime.of(2026, 10, 22, 17, 0),
            LocalDateTime.of(2026, 10, 22, 20, 0));
    private static final LocalDateTime COLLECTED_AT = LocalDateTime.of(2026, 10, 22, 17, 15, 0, 123456000);
    private static final GridPoint POINT = new GridPoint(60, 127);
    private static final GridPoint EXTRA_POINT = new GridPoint(149, 253);
    private static final Map<WeatherElement, Double> SAMPLE = Map.of(
            WeatherElement.TMP, 10.0, WeatherElement.SKY, 1.0, WeatherElement.PTY, 0.0, WeatherElement.POP, 0.0,
            WeatherElement.PCP, 0.0, WeatherElement.SNO, 0.0, WeatherElement.REH, 65.0, WeatherElement.WSD, 0.7);

    private final HourlyForecastAssembler assembler = new HourlyForecastAssembler();

    @Test
    @DisplayName("응답과 값의 순서·유효 격자 수가 달라도 좌표로 결합하고 TMP 격자만 원본 순서로 반환한다")
    void assemblesByCoordinatesAcrossDifferentValidGrids() {
        GridPoint first = new GridPoint(149, 1);
        GridPoint second = new GridPoint(1, 2);
        List<GridForecast> forecasts = new ArrayList<>(List.of(
                forecast(WeatherElement.TMP, value(second, -7.25), value(POINT, 0.0), value(first, 10.0)),
                forecast(WeatherElement.SKY, value(EXTRA_POINT, 4.0), value(POINT, 1.0), value(first, 3.0)),
                forecast(WeatherElement.PTY, value(second, 0.0), value(first, 1.0), value(POINT, 3.0)),
                forecast(WeatherElement.POP, value(POINT, 0.0), value(first, 30.0), value(second, 70.0)),
                forecast(WeatherElement.PCP, value(first, 0.0), value(EXTRA_POINT, 0.0)),
                forecast(WeatherElement.SNO, value(POINT, 0.0), value(second, 0.0), value(first, 0.0)),
                forecast(WeatherElement.REH, value(POINT, 65.0), value(first, 80.0), value(second, 90.0)),
                forecast(WeatherElement.WSD, value(second, 2.3), value(EXTRA_POINT, 12.4), value(first, 0.7))));
        Collections.reverse(forecasts);

        List<HourlyForecast> result = assembler.assemble(TIMES, forecasts, COLLECTED_AT);

        assertThat(result).containsExactly(
                new HourlyForecast(first, TIMES, 10.0, 3.0, 1.0, 30.0, 0.0, 0.0, 80.0, 0.7, COLLECTED_AT),
                new HourlyForecast(second, TIMES, -7.25, null, 0.0, 70.0, null, 0.0, 90.0, 2.3, COLLECTED_AT),
                new HourlyForecast(POINT, TIMES, 0.0, 1.0, 3.0, 0.0, null, 0.0, 65.0, null, COLLECTED_AT));
    }

    @Test
    @DisplayName("8개 응답이 정상이면 TMP 격자의 나머지 7개 값이 모두 결측이어도 한 행을 만든다")
    void keepsTmpGridWithMissingValuesInOtherElements() {
        List<GridForecast> forecasts = WeatherElement.hourlyElements().stream()
                .map(element -> forecast(element, value(element == WeatherElement.TMP ? POINT : EXTRA_POINT,
                        SAMPLE.get(element))))
                .toList();

        List<HourlyForecast> result = assembler.assemble(TIMES, forecasts, COLLECTED_AT);

        assertThat(result).containsExactly(new HourlyForecast(POINT, TIMES,
                10.0, null, null, null, null, null, null, null, COLLECTED_AT));
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 2, 9296, 37697})
    @DisplayName("TMP 응답의 실제 격자 수를 따르며 9295개를 고정하거나 0을 결측으로 보지 않는다")
    void acceptsVariableGridCounts(final int count) {
        List<GridForecast> forecasts = WeatherElement.hourlyElements().stream()
                .map(element -> new GridForecast(TIMES, element, IntStream.range(0, count)
                        .mapToObj(index -> value(GridPoint.fromIndex(index), element == WeatherElement.SKY ? 1.0 : 0.0))
                        .toList()))
                .toList();

        List<HourlyForecast> result = assembler.assemble(TIMES, forecasts, COLLECTED_AT);

        assertThat(result).hasSize(count);
        assertThat(result.getFirst().point()).isEqualTo(new GridPoint(1, 1));
        assertThat(result.getLast().point()).isEqualTo(GridPoint.fromIndex(count - 1));
        assertThat(result).allSatisfy(row -> {
            assertThat(row.tmp()).isZero();
            assertThat(row.sky()).isEqualTo(1.0);
            assertThat(row.pty()).isZero();
            assertThat(row.wsd()).isZero();
        });
    }

    @ParameterizedTest
    @EnumSource(value = WeatherElement.class, names = {"TMN", "TMX"}, mode = EnumSource.Mode.EXCLUDE)
    @DisplayName("8개 중 어느 한 요소의 응답이 없어도 결측값으로 대신하지 않고 결합을 거부한다")
    void rejectsMissingResponse(final WeatherElement missing) {
        List<GridForecast> forecasts = completeForecasts().stream()
                .filter(forecast -> forecast.element() != missing).toList();

        assertThatThrownBy(() -> assembler.assemble(TIMES, forecasts, COLLECTED_AT))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @EnumSource(value = WeatherElement.class, names = {"TMN", "TMX"}, mode = EnumSource.Mode.EXCLUDE)
    @DisplayName("같은 요소의 응답이 중복되면 마지막 응답을 선택하지 않고 거부한다")
    void rejectsDuplicateResponse(final WeatherElement duplicate) {
        List<GridForecast> forecasts = new ArrayList<>(completeForecasts());
        forecasts.add(forecast(duplicate, value(POINT, 99.0)));

        assertThatThrownBy(() -> assembler.assemble(TIMES, forecasts, COLLECTED_AT))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @EnumSource(value = WeatherElement.class, names = {"TMN", "TMX"}, mode = EnumSource.Mode.EXCLUDE)
    @DisplayName("어느 요소라도 발표시각이나 예보대상시각이 다르면 섞지 않는다")
    void rejectsMismatchedTimes(final WeatherElement element) {
        for (ForecastTimes mismatched : List.of(
                new ForecastTimes(LocalDateTime.of(2026, 10, 22, 14, 0), LocalDateTime.of(2026, 10, 22, 20, 0)),
                new ForecastTimes(LocalDateTime.of(2026, 10, 22, 17, 0), LocalDateTime.of(2026, 10, 22, 21, 0)))) {
            GridForecast wrong = new GridForecast(mismatched, element, List.of(value(POINT, SAMPLE.get(element))));

            assertThatThrownBy(() -> assembler.assemble(TIMES, replace(element, wrong), COLLECTED_AT))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Test
    @DisplayName("8개 응답끼리 시각이 같더라도 호출자가 지정한 예상 시각과 다르면 거부한다")
    void rejectsAllResponsesFromWrongRequest() {
        ForecastTimes expected = new ForecastTimes(LocalDateTime.of(2026, 10, 22, 17, 0),
                LocalDateTime.of(2026, 10, 22, 21, 0));

        assertThatThrownBy(() -> assembler.assemble(expected, completeForecasts(), COLLECTED_AT))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @EnumSource(value = WeatherElement.class, names = {"TMN", "TMX"})
    @DisplayName("계획에서 분리한 일별 요소를 시간별 요소 대신 사용하거나 추가할 수 없다")
    void rejectsDailyElements(final WeatherElement element) {
        GridForecast daily = new GridForecast(TIMES, element, List.of(value(POINT, 7.0)));

        assertThatThrownBy(() -> assembler.assemble(TIMES, replace(WeatherElement.TMP, daily), COLLECTED_AT))
                .isInstanceOf(IllegalArgumentException.class);
        List<GridForecast> extra = new ArrayList<>(completeForecasts());
        extra.add(daily);
        assertThatThrownBy(() -> assembler.assemble(TIMES, extra, COLLECTED_AT))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @EnumSource(value = WeatherElement.class, names = {"TMN", "TMX"}, mode = EnumSource.Mode.EXCLUDE)
    @DisplayName("요소 안의 중복 좌표는 TMP 대상 밖에 있어도 조용히 덮어쓰지 않고 거부한다")
    void rejectsDuplicateCoordinates(final WeatherElement element) {
        GridForecast duplicated = forecast(element, value(EXTRA_POINT, 1.0), value(EXTRA_POINT, 2.0));

        assertThatThrownBy(() -> assembler.assemble(TIMES, replace(element, duplicated), COLLECTED_AT))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("빈 응답 목록과 null 입력을 정상 예보로 만들지 않는다")
    void rejectsMissingInputs() {
        List<GridForecast> forecasts = completeForecasts();
        assertThatThrownBy(() -> assembler.assemble(null, forecasts, COLLECTED_AT))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> assembler.assemble(TIMES, null, COLLECTED_AT))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> assembler.assemble(TIMES, forecasts, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> assembler.assemble(TIMES, List.of(), COLLECTED_AT))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> assembler.assemble(TIMES, replace(WeatherElement.TMP, null), COLLECTED_AT))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("이전 결합의 값·격자·수집시각을 다음 호출에 남기지 않고 결과 변경도 허용하지 않는다")
    void isolatesCallsAndKeepsResultsImmutable() {
        List<HourlyForecast> first = assembler.assemble(TIMES, completeForecasts(), COLLECTED_AT);
        List<GridForecast> changed = replace(WeatherElement.TMP, forecast(WeatherElement.TMP, value(EXTRA_POINT, -3.5)));

        List<HourlyForecast> second = assembler.assemble(TIMES, changed, COLLECTED_AT.plusMinutes(1));

        assertThat(first).containsExactly(new HourlyForecast(POINT, TIMES,
                10.0, 1.0, 0.0, 0.0, 0.0, 0.0, 65.0, 0.7, COLLECTED_AT));
        assertThat(second).containsExactly(new HourlyForecast(EXTRA_POINT, TIMES,
                -3.5, null, null, null, null, null, null, null, COLLECTED_AT.plusMinutes(1)));
        assertThatThrownBy(() -> first.clear()).isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> WeatherElement.hourlyElements().clear()).isInstanceOf(UnsupportedOperationException.class);
    }

    private List<GridForecast> completeForecasts() {
        return WeatherElement.hourlyElements().stream()
                .map(element -> forecast(element, value(POINT, SAMPLE.get(element)))).toList();
    }

    private List<GridForecast> replace(final WeatherElement element, final GridForecast replacement) {
        return completeForecasts().stream().map(forecast -> forecast.element() == element ? replacement : forecast).toList();
    }

    private GridForecast forecast(final WeatherElement element, final GridValue... values) {
        return new GridForecast(TIMES, element, List.of(values));
    }

    private GridValue value(final GridPoint point, final double value) {
        return new GridValue(point, value);
    }
}
