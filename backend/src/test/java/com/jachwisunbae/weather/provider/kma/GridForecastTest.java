package com.jachwisunbae.weather.provider.kma;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.weather.domain.ForecastTimes;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.WeatherElement;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class GridForecastTest {

    @ParameterizedTest
    @ValueSource(doubles = {-99, -999, Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY})
    @DisplayName("결측 마커나 유한하지 않은 값을 유효 격자 값으로 만들 수 없다")
    void rejectsMissingAndNonFiniteValues(final double value) {
        assertThatThrownBy(() -> new GridValue(new GridPoint(1, 1), value))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("외부에서 원본 목록을 바꾸어도 예보 값과 개수는 유지된다")
    void protectsParsedValues() {
        GridValue value = new GridValue(new GridPoint(60, 127), 14);
        List<GridValue> values = new ArrayList<>(List.of(value));
        GridForecast forecast = new GridForecast(new ForecastTimes(LocalDateTime.of(2026, 10, 22, 14, 0),
                LocalDateTime.of(2026, 10, 22, 17, 0)),
                WeatherElement.TMP, values);

        values.clear();

        assertThat(forecast.values()).containsExactly(value);
        assertThat(forecast.validCount()).isEqualTo(1);
        assertThat(forecast.missingCount()).isEqualTo(37696);
        assertThatThrownBy(() -> forecast.values().clear()).isInstanceOf(UnsupportedOperationException.class);
    }
}
