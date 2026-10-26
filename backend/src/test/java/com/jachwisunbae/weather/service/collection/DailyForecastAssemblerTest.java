package com.jachwisunbae.weather.service.collection;

import static org.assertj.core.api.Assertions.assertThat;

import com.jachwisunbae.weather.domain.DailyForecast;
import com.jachwisunbae.weather.domain.DailyTemperature;
import com.jachwisunbae.weather.domain.ForecastTimes;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.WeatherElement;
import com.jachwisunbae.weather.provider.kma.GridForecast;
import com.jachwisunbae.weather.provider.kma.KmaForecastRequest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

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
        List<DailyForecast> rows = assembler.assemble(DATE, Set.of(MISSING, SECOND, FIRST), List.of(
                forecast(WeatherElement.TMX, value(SECOND, 0), value(FIRST, 21.5)),
                forecast(WeatherElement.TMN, value(FIRST, -7))), COLLECTED);

        assertThat(rows).containsExactlyInAnyOrder(
                new DailyForecast(FIRST, DATE, temperature(-7.0), temperature(21.5)),
                new DailyForecast(SECOND, DATE, temperature(null), temperature(0.0)),
                new DailyForecast(MISSING, DATE, temperature(null), temperature(null)));
    }

    @Test
    @DisplayName("계획에 없는 요소는 미수집으로 두고 TMP 서비스 격자 밖의 기온은 추가하지 않는다")
    void keepsUnavailableElementUncollected() {
        List<DailyForecast> rows = assembler.assemble(DATE, Set.of(FIRST),
                List.of(forecast(WeatherElement.TMX, value(FIRST, 0), value(SECOND, 22))), COLLECTED);

        assertThat(rows).containsExactlyInAnyOrder(new DailyForecast(FIRST, DATE, null, temperature(0.0)));
    }

    @Test
    @DisplayName("두 요소 모두 계획상 미제공이면 저장 입력을 만들지 않는다")
    void skipsUnavailableDate() {
        assertThat(assembler.assemble(DATE, Set.of(FIRST), List.of(), COLLECTED)).isEmpty();
    }





    private KmaForecastRequest request(final WeatherElement element) {
        return new KmaForecastRequest(new ForecastTimes(PUBLICATION, DATE.atTime(element == WeatherElement.TMN ? 6 : 15, 0)), element);
    }

    @SafeVarargs
    private final GridForecast forecast(final WeatherElement element, final Map.Entry<GridPoint, Double>... values) {
        Double[] cells = new Double[37697];
        for (var value : values) {
            cells[value.getKey().toIndex()] = value.getValue();
        }
        return new GridForecast(request(element).times(), element, cells);
    }

    private Map.Entry<GridPoint, Double> value(final GridPoint point, final double value) {
        return Map.entry(point, value);
    }

    private DailyTemperature temperature(final Double value) {
        return new DailyTemperature(value, PUBLICATION, COLLECTED);
    }
}
