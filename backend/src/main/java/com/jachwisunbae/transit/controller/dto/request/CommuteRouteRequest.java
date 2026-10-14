package com.jachwisunbae.transit.controller.dto.request;

import com.jachwisunbae.transit.domain.vo.Coordinate;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

// 최대 통근 시간과 최대 환승 횟수는 생활권 탐색과 같은 값을 넘겨야 탐색에서 본 통근 시간과 경로가 일치한다.
public record CommuteRouteRequest(
        @NotNull(message = "목적지 위도는 필수입니다.")
        @DecimalMin(value = "-90", message = "위도는 -90 이상 90 이하여야 합니다.")
        @DecimalMax(value = "90", message = "위도는 -90 이상 90 이하여야 합니다.")
        Double latitude,
        @NotNull(message = "목적지 경도는 필수입니다.")
        @DecimalMin(value = "-180", message = "경도는 -180 이상 180 이하여야 합니다.")
        @DecimalMax(value = "180", message = "경도는 -180 이상 180 이하여야 합니다.")
        Double longitude,
        @NotBlank(message = "출발 정류장 ID는 필수입니다.")
        String stopId,
        @Min(value = 1, message = "최대 통근 시간은 1분 이상 60분 이하여야 합니다.")
        @Max(value = 60, message = "최대 통근 시간은 1분 이상 60분 이하여야 합니다.")
        Integer maxMinutes,
        @Min(value = 0, message = "최대 환승 횟수는 0회 이상 2회 이하여야 합니다.")
        @Max(value = 2, message = "최대 환승 횟수는 0회 이상 2회 이하여야 합니다.")
        Integer maxTransfers) {

    private static final int DEFAULT_MAX_MINUTES = 60;
    private static final int DEFAULT_MAX_TRANSFERS = 2;

    public CommuteRouteRequest {
        if (maxMinutes == null) {
            maxMinutes = DEFAULT_MAX_MINUTES;
        }
        if (maxTransfers == null) {
            maxTransfers = DEFAULT_MAX_TRANSFERS;
        }
    }

    public Coordinate destination() {
        return new Coordinate(latitude, longitude);
    }
}
