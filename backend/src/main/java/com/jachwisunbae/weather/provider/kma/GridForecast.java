package com.jachwisunbae.weather.provider.kma;

import com.jachwisunbae.weather.domain.ForecastTimes;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.WeatherElement;
import java.util.List;

// 한 번의 RAW 응답에서 얻은 유효 격자와 요청에 사용한 시각·요소를 함께 보관한다.
public record GridForecast(ForecastTimes times, WeatherElement element, List<GridValue> values) {

    public GridForecast {
        if (times == null || element == null || values == null
                || values.isEmpty() || values.size() > GridPoint.CELL_COUNT) {
            throw new IllegalArgumentException("요청 시각·기상 요소와 유효한 격자 값이 필요합니다.");
        }
        values = List.copyOf(values);
    }

    public int validCount() {
        return values.size();
    }

    public int missingCount() {
        return GridPoint.CELL_COUNT - validCount();
    }
}
