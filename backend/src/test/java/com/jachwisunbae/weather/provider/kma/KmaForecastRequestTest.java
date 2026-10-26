package com.jachwisunbae.weather.provider.kma;

import static org.assertj.core.api.Assertions.assertThat;

import com.jachwisunbae.weather.domain.ForecastTimes;
import com.jachwisunbae.weather.domain.WeatherElement;
import java.time.LocalDateTime;
import java.util.TimeZone;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class KmaForecastRequestTest {

    @ParameterizedTest
    @ValueSource(strings = {"UTC", "America/Los_Angeles"})
    @ResourceLock("default-time-zone")
    @DisplayName("도메인 시각을 시간대 변환 없이 기상청의 10자리 tmfc·tmef로 표현한다")
    void formatsKmaParameters(final String zone) {
        TimeZone previous = TimeZone.getDefault();
        try {
            TimeZone.setDefault(TimeZone.getTimeZone(zone));
            ForecastTimes times = new ForecastTimes(LocalDateTime.of(2028, 2, 29, 23, 0),
                    LocalDateTime.of(2028, 3, 1, 0, 0));
            KmaForecastRequest request = new KmaForecastRequest(times, WeatherElement.TMP);

            assertThat(request.tmfc()).isEqualTo("2028022923");
            assertThat(request.tmef()).isEqualTo("2028030100");
            assertThat(request.times()).isEqualTo(times);
        } finally {
            TimeZone.setDefault(previous);
        }
    }

}
