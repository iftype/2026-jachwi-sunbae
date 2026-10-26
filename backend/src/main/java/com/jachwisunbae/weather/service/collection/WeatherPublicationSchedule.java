package com.jachwisunbae.weather.service.collection;

import java.time.LocalDateTime;
import java.util.List;

// 기상청 단기예보 발표 시각(KST) 규칙을 한곳에서 관리한다.
public final class WeatherPublicationSchedule {
    // 단기예보는 KST 02시부터 3시간 간격으로 하루 8번 발표된다.
    static final List<Integer> HOURS = List.of(2, 5, 8, 11, 14, 17, 20, 23);

    private WeatherPublicationSchedule() { }

    // now(KST) 시점에 이미 제공되었다고 볼 수 있는 가장 최근 발표 시각을 반환한다.
    public static LocalDateTime latestAt(final LocalDateTime now) {
        // 수집 cron과 같은 15분 가정을 사용한다.
        LocalDateTime availableBefore = now.minusMinutes(15);
        // 같은 날짜의 발표 시각을 늦은 시각부터 거슬러 올라가며 처음으로 제공된 발표를 찾는다.
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
