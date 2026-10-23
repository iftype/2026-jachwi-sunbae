package com.jachwisunbae.weather.provider.kma;



// HTTP 시간은 본문 수신까지, 파싱 시간은 UTF-8 디코딩과 격자 검증까지 포함한다.
public record ForecastFetchResult(GridForecast forecast, long responseBytes, long httpNanos, long parseNanos) {

    public ForecastFetchResult {
        if (forecast == null || responseBytes <= 0 || httpNanos < 0 || parseNanos < 0) {
            throw new IllegalArgumentException("정상 예보 응답과 유효한 수신 측정값이 필요합니다.");
        }
    }
}
