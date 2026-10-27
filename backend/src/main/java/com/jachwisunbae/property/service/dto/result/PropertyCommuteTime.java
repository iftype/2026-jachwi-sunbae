package com.jachwisunbae.property.service.dto.result;

// 통근 시간은 REACHABLE일 때만 있고, 초를 분으로 올림한다.
public record PropertyCommuteTime(Long propertyId, String propertyName, PropertyCommuteStatus status,
                                  Integer commuteMinutes) {
}
