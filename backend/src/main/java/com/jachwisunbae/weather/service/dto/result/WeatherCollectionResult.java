package com.jachwisunbae.weather.service.dto.result;

import com.jachwisunbae.weather.provider.kma.KmaForecastRequest;
import java.time.LocalDateTime;
import java.util.List;

// 행 수는 커밋을 마친 UPSERT 입력 수이며 신규 삽입 수나 JDBC 영향 행 수가 아니다.
public record WeatherCollectionResult(LocalDateTime publishedAt, List<RequestMeasurement> requests,
                                      long hourlyRows, long dailyRows, long mergeNanos, long dbNanos, long totalNanos) {

    public WeatherCollectionResult {
        requests = List.copyOf(requests);
    }

    public int requestCount() {
        return requests.size();
    }

    public long responseBytes() {
        return requests.stream().mapToLong(RequestMeasurement::responseBytes).sum();
    }

    public long validValues() {
        return requests.stream().mapToLong(RequestMeasurement::validValues).sum();
    }

    public long missingValues() {
        return requests.stream().mapToLong(RequestMeasurement::missingValues).sum();
    }

    public long httpNanos() {
        return requests.stream().mapToLong(RequestMeasurement::httpNanos).sum();
    }

    public long parseNanos() {
        return requests.stream().mapToLong(RequestMeasurement::parseNanos).sum();
    }

    public record RequestMeasurement(KmaForecastRequest request, long responseBytes, int validValues, int missingValues,
                                     long httpNanos, long parseNanos) {
    }
}
