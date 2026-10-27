package com.jachwisunbae.property.controller.dto.response;

import com.jachwisunbae.property.service.dto.result.PropertyCommuteStatus;
import com.jachwisunbae.property.service.dto.result.PropertyCommuteTime;

public record PropertyCommuteTimeResponse(Long propertyId, String propertyName, PropertyCommuteStatus status,
                                          Integer commuteMinutes) {

    public static PropertyCommuteTimeResponse from(final PropertyCommuteTime commuteTime) {
        return new PropertyCommuteTimeResponse(commuteTime.propertyId(), commuteTime.propertyName(),
                commuteTime.status(), commuteTime.commuteMinutes());
    }
}
