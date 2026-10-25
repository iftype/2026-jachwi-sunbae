package com.jachwisunbae.weather.service.collection;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

class WeatherPublicationScheduleTest {

    @ParameterizedTest
    @ValueSource(ints = {2, 5, 8, 11, 14, 17, 20, 23})
    @DisplayName("8개 발표시각의 대기시간 직전에는 이전 발표분, 경계부터는 새 발표분을 선택한다")
    void selectsAtAvailabilityBoundary(final int hour) {
        LocalDateTime publication = LocalDateTime.of(2026, 10, 23, hour, 0);
        LocalDateTime availableAt = publication.plusMinutes(15);

        assertThat(WeatherPublicationSchedule.latestAt(availableAt.minusNanos(1))).isEqualTo(publication.minusHours(3));
        assertThat(WeatherPublicationSchedule.latestAt(availableAt)).isEqualTo(publication);
        assertThat(WeatherPublicationSchedule.latestAt(availableAt.plusSeconds(1))).isEqualTo(publication);
    }

    @ParameterizedTest
    @CsvSource({
            "2027-01-01T00:00:00, 2026-12-31T23:00:00",
            "2026-11-01T02:14:59, 2026-10-31T23:00:00",
            "2028-03-01T01:00:00, 2028-02-29T23:00:00",
            "2026-10-23T23:59:59, 2026-10-23T23:00:00"
    })
    @DisplayName("자정·월말·연말·윤년 경계를 넘어 최신 발표분을 선택한다")
    void crossesDateBoundary(final LocalDateTime now, final LocalDateTime expected) {
        assertThat(WeatherPublicationSchedule.latestAt(now)).isEqualTo(expected);
    }

}
