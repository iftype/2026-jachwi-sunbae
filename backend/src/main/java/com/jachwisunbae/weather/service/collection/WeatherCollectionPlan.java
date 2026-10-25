package com.jachwisunbae.weather.service.collection;

import com.jachwisunbae.weather.domain.ForecastTimes;
import com.jachwisunbae.weather.domain.WeatherElement;
import com.jachwisunbae.weather.provider.kma.KmaForecastRequest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;

public record WeatherCollectionPlan(List<KmaForecastRequest> hourlyRequests, List<KmaForecastRequest> dailyRequests) {
    public WeatherCollectionPlan {
        hourlyRequests = List.copyOf(hourlyRequests);
        dailyRequests = List.copyOf(dailyRequests);
    }

    public static WeatherCollectionPlan forPublication(final LocalDateTime publishedAt) {
        WeatherPublicationSchedule.validatePublication(publishedAt);
        List<KmaForecastRequest> hourly = IntStream.rangeClosed(1, 48).mapToObj(publishedAt::plusHours)
                .flatMap(target -> WeatherElement.hourlyElements().stream()
                        .map(element -> new KmaForecastRequest(new ForecastTimes(publishedAt, target), element))).toList();
        List<KmaForecastRequest> daily = new ArrayList<>();
        for (LocalDate date = publishedAt.plusHours(1).toLocalDate();
                !date.isAfter(publishedAt.plusHours(48).toLocalDate()); date = date.plusDays(1)) {
            for (WeatherElement element : List.of(WeatherElement.TMN, WeatherElement.TMX)) {
                int lastHour = element == WeatherElement.TMN ? 2 : 11;
                if (!date.equals(publishedAt.toLocalDate()) || publishedAt.getHour() <= lastHour) {
                    int targetHour = element == WeatherElement.TMN ? 6 : 15;
                    daily.add(new KmaForecastRequest(new ForecastTimes(publishedAt, date.atTime(targetHour, 0)), element));
                }
            }
        }
        return new WeatherCollectionPlan(hourly, daily);
    }
}
