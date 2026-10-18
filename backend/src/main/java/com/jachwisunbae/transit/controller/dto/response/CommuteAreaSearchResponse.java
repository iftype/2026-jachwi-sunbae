package com.jachwisunbae.transit.controller.dto.response;

import com.jachwisunbae.transit.service.search.dto.result.CommuteAreaSearchResult;
import java.util.List;

public record CommuteAreaSearchResponse(int maxMinutes, int areaCount, List<CommuteAreaResponse> areas) {

    public static CommuteAreaSearchResponse from(final CommuteAreaSearchResult result) {
        List<CommuteAreaResponse> areas = result.areas().stream().map(CommuteAreaResponse::from).toList();
        return new CommuteAreaSearchResponse(result.maxMinutes(), areas.size(), areas);
    }
}
