package com.jachwisunbae.weather.service.dto.result;

import java.time.Instant;
import java.time.LocalDateTime;

// 현재 실행 또는 마지막 종료 실행의 메모리 상태다. 시작·종료는 실제 순간, 발표시각은 KST다.
public record WeatherCollectionExecution(Source source, Status status, LocalDateTime publishedAt,
                                         Instant startedAt, Instant finishedAt, long elapsedNanos) {

    //누가 시작했는가 -  MANUAL(CLI --published-at), INITIAL_LOAD(--initialize), SCHEDULED(스케줄러)
    public enum Source {
        MANUAL, INITIAL_LOAD, SCHEDULED
    }

    //결과 RUNNING → SUCCEEDED / FAILED / SKIPPED_VALID_FORECAST(최초 적재인데 이미 데이터 있음)
    public enum Status {
        RUNNING, SUCCEEDED, FAILED, SKIPPED_VALID_FORECAST
    }
}
