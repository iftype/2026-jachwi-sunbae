package com.jachwisunbae.property.repository.query;

import java.math.BigDecimal;

public record PropertyListItemQuery(
    Long propertyId,
    String propertyName,
    Long depositAmount,
    Long monthlyRentAmount,
    String discoverySource,
    String address,
    BigDecimal latitude,
    BigDecimal longitude,
    Long photoId,
    String photoUrl,
    String photoContentType,
    int photoCount
) {
}
