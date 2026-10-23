package com.jachwisunbae.weather.service.collection;

import com.jachwisunbae.weather.domain.ForecastTimes;
import com.jachwisunbae.weather.domain.GridPoint;
import com.jachwisunbae.weather.domain.WeatherElement;
import com.jachwisunbae.weather.provider.kma.KmaForecastRequest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;
import java.util.stream.Stream;

// KST 발표시각을 받아 요청 목록만 생성한다. 자료 공개 여부 확인과 HTTP 실행은 수집 단계의 책임이다.
public final class WeatherCollectionPlan {

    private static final int FORECAST_HOURS = 24;
    private static final List<WeatherElement> DAILY_ELEMENTS = List.of(WeatherElement.TMN, WeatherElement.TMX);

    private final LocalDateTime publishedAt;
    private final List<KmaForecastRequest> hourlyRequests; // 예: 02시 발표 → 03시~익일 02시 × 8요소 = 192건
    private final List<KmaForecastRequest> dailyRequests; // 예: 05시 발표 → 당일 TMX 15시,ㅇ 익일 TMN 06시·TMX 15시
    private final List<DailyForecastTarget> unavailableDailyForecasts;

    private WeatherCollectionPlan(final LocalDateTime publishedAt, final List<KmaForecastRequest> hourlyRequests,
                                   final List<KmaForecastRequest> dailyRequests,
                                   final List<DailyForecastTarget> unavailableDailyForecasts) {
        this.publishedAt = publishedAt;
        this.hourlyRequests = List.copyOf(hourlyRequests);
        this.dailyRequests = List.copyOf(dailyRequests);
        this.unavailableDailyForecasts = List.copyOf(unavailableDailyForecasts);
    }

    //보낼 요청 목록 만들기, 시간별 요청은 스트림으로 일별 요청은 날짜 반복문과 addDailyRequests로
    public static WeatherCollectionPlan forPublication(final LocalDateTime publishedAt) {
        WeatherPublicationSchedule.validatePublication(publishedAt);
        //시간별 요청
        List<KmaForecastRequest> hourly = IntStream.rangeClosed(1, FORECAST_HOURS)   // 1, 2, ..., 24
                .mapToObj(publishedAt::plusHours)   // 06시, 07시, ..., 익일 05시
                .flatMap(target -> WeatherElement.hourlyElements().stream()  // 각 시각마다  8개(TMP~WSD)로 펼쳐 이어 붙임
                        .map(element -> new KmaForecastRequest(new ForecastTimes(publishedAt, target), element)))
                .toList();

        //일별 요청
        List<KmaForecastRequest> daily = new ArrayList<>();
        List<DailyForecastTarget> unavailable = new ArrayList<>();
        LocalDate firstDate = publishedAt.plusHours(1).toLocalDate(); // 10/23 06:00 → 10/23
        LocalDate lastDate = publishedAt.plusHours(FORECAST_HOURS).toLocalDate(); // 10/24 05:00 → 10/24
        //시간별 예보 구간(+1h ~ +24h)의 첫 시각과 마지막 시각이 속한 날짜 사이를 순회. 05시 발표면 10/23, 10/24 두 번 호출
        for (LocalDate date = firstDate; !date.isAfter(lastDate); date = date.plusDays(1)) {
            addDailyRequests(publishedAt, date, daily, unavailable);
        }
        return new WeatherCollectionPlan(publishedAt, hourly, daily, unavailable);
    }

    private static void addDailyRequests(final LocalDateTime publishedAt, final LocalDate date,
                                         final List<KmaForecastRequest> requests,
                                         final List<DailyForecastTarget> unavailable) {
        for (WeatherElement element : DAILY_ELEMENTS) { // TMN, TMX
            // 공식 단기예보 활용 가이드: 당일 TMN은 02시, TMX는 11시 발표분까지만 제공한다.
            int lastSameDayPublicationHour = element == WeatherElement.TMN ? 2 : 11;
            if (date.equals(publishedAt.toLocalDate()) && publishedAt.getHour() > lastSameDayPublicationHour) {
                // 발표 당일이고 제공 마감 시각이 지났으면
                unavailable.add(new DailyForecastTarget(date, element));
                continue;
            }
            int targetHour = element == WeatherElement.TMN ? 6 : 15;// // 최저기온이면 06시 최고면 15시
            requests.add(new KmaForecastRequest(new ForecastTimes(publishedAt, date.atTime(targetHour, 0)), element));
        }
    }

    public LocalDateTime publishedAt() {
        return publishedAt;
    }

    public List<KmaForecastRequest> hourlyRequests() {
        return hourlyRequests;
    }

    public List<KmaForecastRequest> dailyRequests() {
        return dailyRequests;
    }

    public List<DailyForecastTarget> unavailableDailyForecasts() {
        return unavailableDailyForecasts;
    }

    public List<KmaForecastRequest> requests() {
        return Stream.concat(hourlyRequests.stream(), dailyRequests.stream()).toList();
    }

    public int requestCount() {
        return hourlyRequests.size() + dailyRequests.size();
    }

    public long expectedRawValueCount() {
        return (long) requestCount() * GridPoint.CELL_COUNT;
    }

    // 응답 크기는 고정 계약이 아니므로 호출자가 실측한 건당 바이트를 전달한다.
    public long estimatedResponseBytes(final long bytesPerResponse) {
        if (bytesPerResponse <= 0) {
            throw new IllegalArgumentException("응답량 추정에는 양수인 건당 응답 바이트가 필요합니다.");
        }
        return Math.multiplyExact(requestCount(), bytesPerResponse);
    }
}
