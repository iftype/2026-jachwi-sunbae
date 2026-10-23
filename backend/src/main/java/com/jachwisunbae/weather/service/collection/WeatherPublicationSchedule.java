package com.jachwisunbae.weather.service.collection;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

// KST 발표 주기와 공개 대기시간으로 수집할 발표분을 선택한다. 실제 공개 여부는 응답 검증으로 확인한다.
public final class WeatherPublicationSchedule {

    private static final List<Integer> PUBLICATION_HOURS = List.of(2, 5, 8, 11, 14, 17, 20, 23);

    private final Duration publicationDelay;

    public WeatherPublicationSchedule(final Duration publicationDelay) {
        if (publicationDelay == null || publicationDelay.isNegative()) {
            throw new IllegalArgumentException("공개 대기시간은 0 이상이어야 합니다.");
        }
        this.publicationDelay = publicationDelay;
    }

    public LocalDateTime latestAt(final LocalDateTime now) {
        LocalDateTime availableBefore = now.minus(publicationDelay);// 05:20 - 15분 = 05:05
        for (int index = PUBLICATION_HOURS.size() - 1; index >= 0; index--) { // 23 → 20 → ... → 2 (뒤에서부터)
            LocalDateTime candidate = availableBefore.toLocalDate().atTime(PUBLICATION_HOURS.get(index), 0);
            if (!candidate.isAfter(availableBefore)) { // 후보 ≤ 05:05 이면
                return candidate; // 그게 가장 최근 발표분
            }
        }  // 오늘 02시도 아직이면 → 전날 23시(하나도 없으면 무조건 전날 23시)
        return availableBefore.toLocalDate().minusDays(1).atTime(PUBLICATION_HOURS.getLast(), 0);
    }

    // 지나간 실행을 즉시 따라잡지 않고 주어진 시각 이후의 다음 발표분 공개 대기시각을 반환한다.
    public LocalDateTime nextCollectionAfter(final LocalDateTime now) {
        return latestAt(now).plusHours(3).plus(publicationDelay);
    }

    public static void validatePublication(final LocalDateTime publishedAt) {
        if (publishedAt == null || !publishedAt.equals(publishedAt.truncatedTo(ChronoUnit.HOURS))
                || !PUBLICATION_HOURS.contains(publishedAt.getHour())) {
            throw new IllegalArgumentException("발표 시각은 KST 02·05·08·11·14·17·20·23시 정시여야 합니다.");
        }
    }
}
