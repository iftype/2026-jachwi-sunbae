package com.jachwisunbae.transit.service.dto.result;

public record GtfsImportResult(int routeCount, int stopCount, int edgeCount, int transferCount) {
}
