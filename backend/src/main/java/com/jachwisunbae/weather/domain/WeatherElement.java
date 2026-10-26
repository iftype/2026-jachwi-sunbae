package com.jachwisunbae.weather.domain;

import java.util.List;

// API의 vars와 대응한다. 값의 단위·코드 해석은 RAW 파싱과 분리한다.
public enum WeatherElement {
    TMP, // 기온(℃)
    SKY, // 하늘상태(맑음·구름많음·흐림)
    PTY, // 강수형태(없음·비·눈·비/눈 등)
    POP, // 강수확률(%), 공식 격자 API 문서에는 '강수유무'로 표기
    PCP, // 1시간 강수량(mm)
    SNO, // 1시간 신적설(cm)
    REH, // 상대습도(%)
    WSD, // 풍속(m/s)
    TMN, // 일 최저기온(℃)
    TMX; // 일 최고기온(℃)

    private static final List<WeatherElement> HOURLY_ELEMENTS = List.of(TMP, SKY, PTY, POP, PCP, SNO, REH, WSD);

    public static List<WeatherElement> hourlyElements() {
        return HOURLY_ELEMENTS;
    }
}
