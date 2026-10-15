package com.jachwisunbae.map.controller.dto.response.cctv;

import com.jachwisunbae.map.service.dto.result.cctv.CctvsResult;
import java.math.BigDecimal;
import java.util.List;

public record CctvsResponse(Center center, int radius, int count, List<CctvResponse> cctvs) {

    public static CctvsResponse from(CctvsResult result) {
        List<CctvResponse> cctvs = result.cctvs().stream().map(CctvResponse::from).toList();
        return new CctvsResponse(new Center(result.latitude(), result.longitude()), result.radius(), cctvs.size(),
                cctvs);
    }

    public record Center(BigDecimal latitude, BigDecimal longitude) {
    }
}
