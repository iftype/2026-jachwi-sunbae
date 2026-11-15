package com.jachwisunbae.property.controller.dto.response;

import com.jachwisunbae.property.repository.query.PropertyListItemQuery;
import java.math.BigDecimal;
import java.util.List;

public record PropertyListItemResponse(
    Long id,
    String name,
    Long depositAmount,
    Long monthlyRentAmount,
    String discoverySource,
    String address,
    BigDecimal latitude,
    BigDecimal longitude,
    int photoCount,
    PropertyRepresentativePhoto representativePhoto,
    PropertyProgress overallProgress,
    List<PropertyChecklistStageResponse> stages
) {
    public static PropertyListItemResponse from(final PropertyListItemQuery row,
                                                final PropertyRepresentativePhoto photo,
                                                final PropertyProgress progress,
                                                final List<PropertyChecklistStageResponse> stages) {
        return new PropertyListItemResponse(
            row.propertyId(),
            row.propertyName(),
            row.depositAmount(),
            row.monthlyRentAmount(),
            row.discoverySource(),
            row.address(),
            row.latitude(),
            row.longitude(),
            row.photoCount(),
            photo,
            progress,
            List.copyOf(stages)
        );
    }
}
