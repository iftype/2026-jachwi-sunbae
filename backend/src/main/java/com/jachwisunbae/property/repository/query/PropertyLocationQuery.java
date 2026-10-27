package com.jachwisunbae.property.repository.query;

import java.math.BigDecimal;

public record PropertyLocationQuery(
    Long propertyId,
    String propertyName,
    BigDecimal latitude,
    BigDecimal longitude
) {

    public boolean hasLocation() {
        return latitude != null && longitude != null;
    }
}
