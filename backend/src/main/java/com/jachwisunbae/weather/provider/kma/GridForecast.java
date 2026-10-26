package com.jachwisunbae.weather.provider.kma;

import com.jachwisunbae.weather.domain.ForecastTimes;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.WeatherElement;
import java.util.Arrays;
import java.util.Objects;

// 파서가 확인한 원본 순서의 37,697칸이다. null은 기상청 결측이며 내부 조립 과정에서는 배열을 변경하지 않는다.
public record GridForecast(ForecastTimes times, WeatherElement element, Double[] values) {
    public int validCount() {
        return (int) Arrays.stream(values).filter(Objects::nonNull).count();
    }

    public int missingCount() {
        return GridPoint.CELL_COUNT - validCount();
    }
}
