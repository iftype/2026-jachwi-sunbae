package com.jachwisunbae.weather.service.collection;

import com.jachwisunbae.weather.domain.DailyForecast;
import com.jachwisunbae.weather.domain.DailyTemperature;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.WeatherElement;
import com.jachwisunbae.weather.provider.kma.GridForecast;
import com.jachwisunbae.weather.provider.kma.GridValue;
import com.jachwisunbae.weather.provider.kma.KmaForecastRequest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

// 같은 날짜의 TMP 서비스 격자에 일별 기온을 연결한다. 미제공과 정상 결측을 구분한다.
public class DailyForecastAssembler {

    public List<DailyForecast> assemble(final LocalDate date, final Set<GridPoint> points,
                                       final List<KmaForecastRequest> requests, final List<GridForecast> forecasts,
                                       final LocalDateTime collectedAt) {
        if (date == null || points == null || points.stream().anyMatch(Objects::isNull) || requests == null || forecasts == null
                || collectedAt == null) {
            throw new IllegalArgumentException("일별 대상 날짜·격자·요청 계획·응답·수집 시각이 필요합니다.");
        }
        Map<WeatherElement, KmaForecastRequest> expected = indexRequests(date, requests);
        Map<WeatherElement, Double[]> values = indexForecasts(expected, forecasts);
        if (expected.isEmpty()) {
            return List.of();
        }
        List<DailyForecast> result = new ArrayList<>();
        for (int index = 0; index < GridPoint.CELL_COUNT; index++) {
            GridPoint point = GridPoint.fromIndex(index);
            if (points.contains(point)) {
                result.add(new DailyForecast(point, date,
                        temperature(WeatherElement.TMN, index, expected, values, collectedAt),
                        temperature(WeatherElement.TMX, index, expected, values, collectedAt)));
            }
        }
        return List.copyOf(result);
    }

    private Map<WeatherElement, KmaForecastRequest> indexRequests(final LocalDate date,
                                                              final List<KmaForecastRequest> requests) {
        Map<WeatherElement, KmaForecastRequest> expected = new EnumMap<>(WeatherElement.class);
        LocalDateTime publication = null;
        for (KmaForecastRequest request : requests) {
            if (request == null || !List.of(WeatherElement.TMN, WeatherElement.TMX).contains(request.element())) {
                throw new IllegalArgumentException("일별 수집 계획에는 TMN·TMX만 사용할 수 있습니다.");
            }
            int hour = request.element() == WeatherElement.TMN ? 6 : 15;
            if (!date.atTime(hour, 0).equals(request.times().forecastAt())
                    || (publication != null && !publication.equals(request.times().publishedAt()))
                    || expected.putIfAbsent(request.element(), request) != null) {
                throw new IllegalArgumentException("일별 요청은 같은 발표분·날짜의 TMN 06시·TMX 15시여야 합니다.");
            }
            publication = request.times().publishedAt();
        }
        return expected;
    }

    private Map<WeatherElement, Double[]> indexForecasts(final Map<WeatherElement, KmaForecastRequest> expected,
                                                        final List<GridForecast> forecasts) {
        Map<WeatherElement, Double[]> indexed = new EnumMap<>(WeatherElement.class);
        for (GridForecast forecast : forecasts) {
            if (forecast == null || !expected.containsKey(forecast.element())
                    || !expected.get(forecast.element()).times().equals(forecast.times())
                    || indexed.containsKey(forecast.element())) {
                throw new IllegalArgumentException("일별 응답의 시각·요소가 요청 계획과 일치해야 합니다.");
            }
            Double[] values = new Double[GridPoint.CELL_COUNT];
            for (GridValue value : forecast.values()) {
                int index = (value.point().ny() - 1) * GridPoint.WIDTH + value.point().nx() - 1;
                if (values[index] != null) {
                    throw new IllegalArgumentException("일별 응답 안에 중복 격자가 있습니다.");
                }
                values[index] = value.value();
            }
            indexed.put(forecast.element(), values);
        }
        if (indexed.size() != expected.size()) {
            throw new IllegalArgumentException("계획된 일별 기온의 정상 응답이 모두 필요합니다.");
        }
        return indexed;
    }

    private DailyTemperature temperature(final WeatherElement element, final int index,
                                         final Map<WeatherElement, KmaForecastRequest> expected,
                                         final Map<WeatherElement, Double[]> values,
                                         final LocalDateTime collectedAt) {
        if (!expected.containsKey(element)) {
            return null;
        }
        return new DailyTemperature(values.get(element)[index], expected.get(element).times().publishedAt(), collectedAt);
    }
}
