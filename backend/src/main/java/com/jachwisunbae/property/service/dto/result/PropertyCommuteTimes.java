package com.jachwisunbae.property.service.dto.result;

import java.util.List;

public record PropertyCommuteTimes(int maxMinutes, int maxTransfers, List<PropertyCommuteTime> properties) {
}
