package com.jachwisunbae.property.controller.dto.response;

import com.jachwisunbae.property.service.dto.result.PropertyCommuteTimes;
import java.util.List;

public record PropertyCommuteTimesResponse(int maxMinutes, int maxTransfers,
                                           List<PropertyCommuteTimeResponse> properties) {

    public static PropertyCommuteTimesResponse from(final PropertyCommuteTimes commuteTimes) {
        return new PropertyCommuteTimesResponse(commuteTimes.maxMinutes(), commuteTimes.maxTransfers(),
                commuteTimes.properties().stream().map(PropertyCommuteTimeResponse::from).toList());
    }
}
