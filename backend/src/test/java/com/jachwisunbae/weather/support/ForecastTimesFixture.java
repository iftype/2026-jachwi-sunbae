package com.jachwisunbae.weather.support;

import com.jachwisunbae.weather.domain.ForecastTimes;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.ResolverStyle;
import java.util.Locale;

// CSV 원본과 HTTP 검증 데이터의 시각을 읽는 테스트 전용 도구다. 운영 코드의 입력 해석을 대신하지 않는다.
public final class ForecastTimesFixture {

    private static final DateTimeFormatter FORMAT = DateTimeFormatter.ofPattern("uuuuMMddHH", Locale.ROOT)
            .withResolverStyle(ResolverStyle.STRICT);

    private ForecastTimesFixture() {
    }

    public static ForecastTimes times(final String publication, final String forecast) {
        return new ForecastTimes(LocalDateTime.parse(publication, FORMAT), LocalDateTime.parse(forecast, FORMAT));
    }
}
