package com.jachwisunbae.property.controller.dto.request;

import com.jachwisunbae.transit.domain.vo.Coordinate;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

public record PropertyCommuteTimeRequest(
        @NotNull(message = "목적지 위도는 필수입니다.")
        @DecimalMin(value = "-90", message = "위도는 -90 이상 90 이하여야 합니다.")
        @DecimalMax(value = "90", message = "위도는 -90 이상 90 이하여야 합니다.")
        Double latitude,
        @NotNull(message = "목적지 경도는 필수입니다.")
        @DecimalMin(value = "-180", message = "경도는 -180 이상 180 이하여야 합니다.")
        @DecimalMax(value = "180", message = "경도는 -180 이상 180 이하여야 합니다.")
        Double longitude) {

    public Coordinate destination() {
        return new Coordinate(latitude, longitude);
    }
}
