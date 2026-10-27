package com.jachwisunbae.weather.service.collection;

import java.time.LocalDateTime;
import java.util.List;

public final class WeatherPublicationSchedule {
    static final List<Integer> HOURS = List.of(2, 5, 8, 11, 14, 17, 20, 23);

    private WeatherPublicationSchedule() { }

    public static LocalDateTime latestAt(final LocalDateTime now) {
        // 수집 cron과 같은 15분 가정을 사용한다.
        LocalDateTime availableBefore = now.minusMinutes(15);
        for (int index = HOURS.size() - 1; index >= 0; index--) {
            LocalDateTime candidate = availableBefore.toLocalDate().atTime(HOURS.get(index), 0);
            if (!candidate.isAfter(availableBefore)) {
                return candidate;
            }
        }
        // 02시 발표도 아직 제공 전인 새벽이라면 전날 23시 발표가 최신이다.
        return availableBefore.toLocalDate().minusDays(1).atTime(23, 0);
    }
}
