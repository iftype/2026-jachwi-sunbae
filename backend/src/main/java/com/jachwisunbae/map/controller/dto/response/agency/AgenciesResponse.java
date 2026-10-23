package com.jachwisunbae.map.controller.dto.response.agency;

import com.jachwisunbae.map.service.dto.result.agency.AgenciesResult;
import java.math.BigDecimal;
import java.util.List;

public record AgenciesResponse(Center center, int radius, int count, List<AgencyResponse> agencies) {

    public static AgenciesResponse from(AgenciesResult result) {
        List<AgencyResponse> agencies = result.agencies().stream().map(AgencyResponse::from).toList();
        return new AgenciesResponse(new Center(result.latitude(), result.longitude()), result.radius(),
                agencies.size(), agencies);
    }

    public record Center(BigDecimal latitude, BigDecimal longitude) {
    }
}
