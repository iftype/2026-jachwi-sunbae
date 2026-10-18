package com.jachwisunbae.transit.service.dto.result;

// matchedStopCount는 행정동이 붙은 정류장 수다. 행정동 경계가 적재되지 않았으면 0이다.
public record GtfsImportResult(int routeCount, int stopCount, int edgeCount, int transferCount,
                               int matchedStopCount) {
}
