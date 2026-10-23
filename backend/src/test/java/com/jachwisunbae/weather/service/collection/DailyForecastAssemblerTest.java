package com.jachwisunbae.weather.service.collection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.weather.domain.DailyForecast;
import com.jachwisunbae.weather.domain.DailyTemperature;
import com.jachwisunbae.weather.domain.ForecastTimes;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.WeatherElement;
import com.jachwisunbae.weather.provider.kma.GridForecast;
import com.jachwisunbae.weather.provider.kma.GridValue;
import com.jachwisunbae.weather.provider.kma.KmaForecastRequest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class DailyForecastAssemblerTest {

    private static final LocalDate DATE = LocalDate.of(2026, 10, 23);
    private static final LocalDateTime PUBLICATION = DATE.atTime(2, 0);
    private static final LocalDateTime COLLECTED = DATE.atTime(2, 30);
    private static final GridPoint FIRST = new GridPoint(60, 127);
    private static final GridPoint SECOND = new GridPoint(79, 150);
    private static final GridPoint MISSING = new GridPoint(91, 213);
    private final DailyForecastAssembler assembler = new DailyForecastAssembler();

    @Test
    @DisplayName("좌표로 일별 기온을 결합하며 한쪽·양쪽 정상 결측에도 출처를 남긴다")
    void joinsDailyTemperaturesByCoordinates() {
        List<DailyForecast> rows = assembler.assemble(DATE, Set.of(MISSING, SECOND, FIRST), requests(), List.of(
                forecast(WeatherElement.TMX, new GridValue(SECOND, 0), new GridValue(FIRST, 21.5)),
                forecast(WeatherElement.TMN, new GridValue(FIRST, -7))), COLLECTED);

        assertThat(rows).containsExactly(
                new DailyForecast(FIRST, DATE, temperature(-7.0), temperature(21.5)),
                new DailyForecast(SECOND, DATE, temperature(null), temperature(0.0)),
                new DailyForecast(MISSING, DATE, temperature(null), temperature(null)));
        assertThatThrownBy(rows::clear).isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    @DisplayName("계획에 없는 요소는 미수집으로 두고 TMP 서비스 격자 밖의 기온은 추가하지 않는다")
    void keepsUnavailableElementUncollected() {
        List<DailyForecast> rows = assembler.assemble(DATE, Set.of(FIRST), List.of(request(WeatherElement.TMX)),
                List.of(forecast(WeatherElement.TMX, new GridValue(FIRST, 0), new GridValue(SECOND, 22))), COLLECTED);

        assertThat(rows).containsExactly(new DailyForecast(FIRST, DATE, null, temperature(0.0)));
    }

    @Test
    @DisplayName("두 요소 모두 계획상 미제공이면 저장 입력을 만들지 않는다")
    void skipsUnavailableDate() {
        assertThat(assembler.assemble(DATE, Set.of(FIRST), List.of(), List.of(), COLLECTED)).isEmpty();
    }

    @Test
    @DisplayName("계획된 응답의 누락·중복·잘못된 시각·잘못된 요소를 정상 결측으로 처리하지 않는다")
    void rejectsIncompleteOrMismatchedResponses() {
        GridForecast tmn = forecast(WeatherElement.TMN, new GridValue(FIRST, 7));
        GridForecast tmx = forecast(WeatherElement.TMX, new GridValue(FIRST, 21));
        List<List<GridForecast>> invalid = List.of(List.of(), List.of(tmn), List.of(tmn, tmn),
                List.of(tmn, tmx, tmx), List.of(tmn, new GridForecast(
                        new ForecastTimes(PUBLICATION, DATE.plusDays(1).atTime(15, 0)), WeatherElement.TMX, tmx.values())),
                List.of(tmn, new GridForecast(tmx.times(), WeatherElement.TMP, tmx.values())));
        for (List<GridForecast> responses : invalid) {
            assertThatThrownBy(() -> assembler.assemble(DATE, Set.of(FIRST), requests(), responses, COLLECTED))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Test
    @DisplayName("대상 격자 밖의 중복 좌표도 거부한다")
    void rejectsDuplicateCoordinates() {
        GridForecast duplicate = forecast(WeatherElement.TMX, new GridValue(SECOND, 21), new GridValue(SECOND, 22));
        assertThatThrownBy(() -> assembler.assemble(DATE, Set.of(FIRST), List.of(request(WeatherElement.TMX)),
                List.of(duplicate), COLLECTED)).isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 14, 23})
    @DisplayName("날짜·요소별 잘못된 대상 시각의 계획을 거부한다")
    void rejectsWrongTargetHour(final int hour) {
        KmaForecastRequest invalid = new KmaForecastRequest(new ForecastTimes(PUBLICATION, DATE.atTime(hour, 0)), WeatherElement.TMX);
        assertThatThrownBy(() -> assembler.assemble(DATE, Set.of(FIRST), List.of(invalid), List.of(), COLLECTED))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private List<KmaForecastRequest> requests() {
        return List.of(request(WeatherElement.TMN), request(WeatherElement.TMX));
    }

    private KmaForecastRequest request(final WeatherElement element) {
        return new KmaForecastRequest(new ForecastTimes(PUBLICATION, DATE.atTime(element == WeatherElement.TMN ? 6 : 15, 0)), element);
    }

    private GridForecast forecast(final WeatherElement element, final GridValue... values) {
        return new GridForecast(request(element).times(), element, List.of(values));
    }

    private DailyTemperature temperature(final Double value) {
        return new DailyTemperature(value, PUBLICATION, COLLECTED);
    }
}
