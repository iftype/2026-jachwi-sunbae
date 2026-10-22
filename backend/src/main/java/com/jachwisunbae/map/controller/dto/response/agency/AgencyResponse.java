package com.jachwisunbae.map.controller.dto.response.agency;

import com.jachwisunbae.map.domain.agency.Agency;
import java.math.BigDecimal;

// phone, placeUrl은 공급자에 정보가 없으면 null이다.
public record AgencyResponse(String providerPlaceId, String name, String address, BigDecimal latitude,
                             BigDecimal longitude, int distanceMeters, String phone, String placeUrl) {

    public static AgencyResponse from(Agency agency) {
        return new AgencyResponse(agency.providerPlaceId(), agency.name(), agency.address(), agency.latitude(),
                agency.longitude(), agency.distanceMeters(), agency.phone(), agency.placeUrl());
    }
}
