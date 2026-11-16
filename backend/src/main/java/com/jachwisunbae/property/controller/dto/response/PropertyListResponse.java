package com.jachwisunbae.property.controller.dto.response;

import com.jachwisunbae.property.service.dto.result.PropertyListItemResult;
import java.util.List;

public record PropertyListResponse(int totalCount, List<PropertyListItemResponse> items) {

    public static PropertyListResponse fromResults(final List<PropertyListItemResult> results) {
        return new PropertyListResponse(results.size(), results.stream().map(PropertyListItemResponse::from).toList());
    }
}
