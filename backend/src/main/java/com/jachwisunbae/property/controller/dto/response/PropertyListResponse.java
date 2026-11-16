package com.jachwisunbae.property.controller.dto.response;

import java.util.List;

public record PropertyListResponse(int totalCount, List<PropertyListItemResponse> items) {
}
