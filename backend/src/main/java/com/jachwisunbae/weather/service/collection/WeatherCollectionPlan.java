package com.jachwisunbae.weather.service.collection;

import com.jachwisunbae.weather.domain.ForecastTimes;
import com.jachwisunbae.weather.domain.WeatherElement;
import com.jachwisunbae.weather.provider.kma.KmaForecastRequest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;

public record WeatherCollectionPlan(List<KmaForecastRequest> hourlyRequests, List<KmaForecastRequest> dailyRequests) {
    private static final int FORECAST_HOURS = 48;
    // 최저기온(TMN)은 06시, 최고기온(TMX)은 15시 예보 시각으로 요청한다.
    private static final int TMN_FORECAST_HOUR = 6;
    private static final int TMX_FORECAST_HOUR = 15;
    // 당일 TMN은 02시 발표까지, 당일 TMX는 11시 발표까지만 제공된다.
    private static final int TMN_LAST_PUBLICATION_HOUR = 2;
    private static final int TMX_LAST_PUBLICATION_HOUR = 11;

    public WeatherCollectionPlan {
        hourlyRequests = List.copyOf(hourlyRequests);
        dailyRequests = List.copyOf(dailyRequests);
    }

    public static WeatherCollectionPlan forPublication(final LocalDateTime publishedAt) {
        validatePublication(publishedAt);
        return new WeatherCollectionPlan(hourlyRequests(publishedAt), dailyRequests(publishedAt));
    }

    private static void validatePublication(final LocalDateTime publishedAt) {
        if (publishedAt == null || !publishedAt.equals(publishedAt.truncatedTo(ChronoUnit.HOURS))
                || !WeatherPublicationSchedule.HOURS.contains(publishedAt.getHour())) {
            throw new IllegalArgumentException("발표 시각은 KST 02·05·08·11·14·17·20·23시 정시여야 합니다.");
        }
    }

    // 예보 시각(1~48시간 뒤)마다 시간별 요소 8개를 요청한다. 같은 시각의 요청끼리 연속으로 놓인다.
    private static List<KmaForecastRequest> hourlyRequests(final LocalDateTime publishedAt) {
        return IntStream.rangeClosed(1, FORECAST_HOURS)
                .mapToObj(publishedAt::plusHours)
                .flatMap(forecastAt -> WeatherElement.hourlyElements().stream()
                        .map(element -> request(publishedAt, forecastAt, element)))
                .toList();
    }

    // 수집 범위에 걸친 날짜마다 TMN·TMX를 요청하되, 이미 제공이 끝난 당일 값은 제외한다.
    private static List<KmaForecastRequest> dailyRequests(final LocalDateTime publishedAt) {
        List<KmaForecastRequest> requests = new ArrayList<>();
        LocalDate lastDate = publishedAt.plusHours(FORECAST_HOURS).toLocalDate();
        for (LocalDate date = publishedAt.plusHours(1).toLocalDate(); !date.isAfter(lastDate); date = date.plusDays(1)) {
            if (isProvided(publishedAt, date, TMN_LAST_PUBLICATION_HOUR)) {
                requests.add(request(publishedAt, date.atTime(TMN_FORECAST_HOUR, 0), WeatherElement.TMN));
            }
            if (isProvided(publishedAt, date, TMX_LAST_PUBLICATION_HOUR)) {
                requests.add(request(publishedAt, date.atTime(TMX_FORECAST_HOUR, 0), WeatherElement.TMX));
            }
        }
        return requests;
    }

    private static boolean isProvided(final LocalDateTime publishedAt, final LocalDate date,
                                      final int lastPublicationHour) {
        return !date.equals(publishedAt.toLocalDate()) || publishedAt.getHour() <= lastPublicationHour;
    }

    private static KmaForecastRequest request(final LocalDateTime publishedAt, final LocalDateTime forecastAt,
                                              final WeatherElement element) {
        return new KmaForecastRequest(new ForecastTimes(publishedAt, forecastAt), element);
    }
}
