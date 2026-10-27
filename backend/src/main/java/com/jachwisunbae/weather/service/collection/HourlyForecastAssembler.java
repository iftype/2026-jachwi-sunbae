package com.jachwisunbae.weather.service.collection;

import com.jachwisunbae.weather.domain.ForecastTimes;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.HourlyForecast;
import com.jachwisunbae.weather.domain.WeatherElement;
import com.jachwisunbae.weather.provider.kma.GridForecast;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

public class HourlyForecastAssembler {
    public List<HourlyForecast> assemble(final ForecastTimes times, final List<GridForecast> forecasts,
                                         final LocalDateTime collectedAt) {
        Map<WeatherElement, Double[]> values = new EnumMap<>(WeatherElement.class);
        forecasts.forEach(forecast -> values.put(forecast.element(), forecast.values()));
        if (forecasts.size() != 8 || !values.keySet().containsAll(WeatherElement.hourlyElements())) {
            throw new IllegalArgumentException("시간별 예보 결합에는 8개 요소의 정상 응답이 모두 필요합니다.");
        }
        List<HourlyForecast> result = new ArrayList<>();
        for (int index = 0; index < GridPoint.CELL_COUNT; index++) {
            Double temperature = values.get(WeatherElement.TMP)[index];
            if (temperature != null) {
                // 모든 요소에서 같은 원본 인덱스를 사용하며 TMP가 있는 격자만 서비스한다.
                result.add(new HourlyForecast(GridPoint.fromIndex(index), times, temperature,
                        values.get(WeatherElement.SKY)[index], values.get(WeatherElement.PTY)[index],
                        values.get(WeatherElement.POP)[index], values.get(WeatherElement.PCP)[index],
                        values.get(WeatherElement.SNO)[index], values.get(WeatherElement.REH)[index],
                        values.get(WeatherElement.WSD)[index], collectedAt));
            }
        }
        return result;
    }
}
