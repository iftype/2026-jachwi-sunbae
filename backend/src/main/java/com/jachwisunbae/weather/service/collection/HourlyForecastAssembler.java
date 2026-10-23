package com.jachwisunbae.weather.service.collection;

import com.jachwisunbae.weather.domain.ForecastTimes;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.HourlyForecast;
import com.jachwisunbae.weather.domain.WeatherElement;
import com.jachwisunbae.weather.provider.kma.GridForecast;
import com.jachwisunbae.weather.provider.kma.GridValue;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

// 한 예보시각의 8개 정상 응답을 TMP 유효 격자 기준으로 결합한다.
public class HourlyForecastAssembler {

    //한 예보시각의 "요소별 전국 자료 8개"를 "격자별 한 행" 목록으로 바꾸는 변환기 (TMP가 있는)
    public List<HourlyForecast> assemble(final ForecastTimes expectedTimes, final List<GridForecast> forecasts,
                                          final LocalDateTime collectedAt) {
        if (expectedTimes == null || forecasts == null || collectedAt == null) {
            throw new IllegalArgumentException("예상 요청 시각·요소별 응답·수집 완료 시각이 필요합니다.");
        }
        Map<WeatherElement, Double[]> values = indexForecasts(expectedTimes, forecasts);
        Double[] temperatures = values.get(WeatherElement.TMP);
        List<HourlyForecast> result = new ArrayList<>();
        for (int index = 0; index < GridPoint.CELL_COUNT; index++) {
            if (temperatures[index] == null) {
                continue; // TMP 없는 격자는 건너뜀
            }
            result.add(new HourlyForecast(GridPoint.fromIndex(index), expectedTimes, temperatures[index],
                    values.get(WeatherElement.SKY)[index], values.get(WeatherElement.PTY)[index],
                    values.get(WeatherElement.POP)[index], values.get(WeatherElement.PCP)[index],
                    values.get(WeatherElement.SNO)[index], values.get(WeatherElement.REH)[index],
                    values.get(WeatherElement.WSD)[index], collectedAt));
        }
        return List.copyOf(result);
    }

    // 요소별 배열 만들기
    private Map<WeatherElement, Double[]> indexForecasts(final ForecastTimes expectedTimes,
                                                         final List<GridForecast> forecasts) {
        // {TMP → Double[37697], SKY → Double[37697], ...}
        Map<WeatherElement, Double[]> indexed = new EnumMap<>(WeatherElement.class);

        for (GridForecast forecast : forecasts) {
            if (forecast == null || !expectedTimes.equals(forecast.times())) {
                throw new IllegalArgumentException("모든 응답의 발표·예보 시각이 예상 요청 시각과 같아야 합니다.");
            }
            WeatherElement element = forecast.element();
            if (!WeatherElement.hourlyElements().contains(element)) {
                throw new IllegalArgumentException("시간별 예보에 일별 요소를 결합할 수 없습니다. element=" + element);
            }
            if (indexed.containsKey(element)) {
                throw new IllegalArgumentException("같은 기상 요소의 응답을 중복 결합할 수 없습니다. element=" + element);
            }
            indexed.put(element, indexValues(forecast));
        }
        if (indexed.size() != WeatherElement.hourlyElements().size()) {
            throw new IllegalArgumentException("시간별 예보 결합에는 8개 요소의 정상 응답이 모두 필요합니다.");
        }
        return indexed;
    }

    //값을 격자 위치에 배치
    private Double[] indexValues(final GridForecast forecast) {
        Double[] values = new Double[GridPoint.CELL_COUNT];  // 37,697칸, 처음엔 전부 null
        for (GridValue value : forecast.values()) {
            // 결측을 제외한 목록의 순서가 아니라 원본 격자 좌표로 위치를 복원한다.
            GridPoint point = value.point();
            int index = (point.ny() - 1) * GridPoint.WIDTH + point.nx() - 1;
            if (values[index] != null) {
                throw new IllegalArgumentException("같은 요소 안에 중복 격자가 있습니다. element=" + forecast.element());
            }
            values[index] = value.value();
        }
        return values;
    }
}
