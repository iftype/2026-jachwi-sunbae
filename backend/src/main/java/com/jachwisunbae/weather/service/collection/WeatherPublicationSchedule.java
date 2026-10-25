package com.jachwisunbae.weather.service.collection;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

public final class WeatherPublicationSchedule {
    private static final List<Integer> HOURS = List.of(2, 5, 8, 11, 14, 17, 20, 23);

    private WeatherPublicationSchedule() { }

    public static LocalDateTime latestAt(final LocalDateTime now) {
        // 실제 제공 지연은 아직 검증 전이다. 수집 cron과 같은 15분 가정을 사용한다.
        LocalDateTime availableBefore = now.minusMinutes(15);
        for (int index = HOURS.size() - 1; index >= 0; index--) {
            LocalDateTime candidate = availableBefore.toLocalDate().atTime(HOURS.get(index), 0);
            if (!candidate.isAfter(availableBefore)) {
                return candidate;
            }
        }
        return availableBefore.toLocalDate().minusDays(1).atTime(23, 0);
    }

    public static void validatePublication(final LocalDateTime publishedAt) {
        if (publishedAt == null || !publishedAt.equals(publishedAt.truncatedTo(ChronoUnit.HOURS))
                || !HOURS.contains(publishedAt.getHour())) {
            throw new IllegalArgumentException("발표 시각은 KST 02·05·08·11·14·17·20·23시 정시여야 합니다.");
        }
    }
}
