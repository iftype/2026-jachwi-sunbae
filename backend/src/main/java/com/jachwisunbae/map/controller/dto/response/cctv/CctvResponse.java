package com.jachwisunbae.map.controller.dto.response.cctv;

import com.jachwisunbae.map.domain.cctv.Cctv;
import com.jachwisunbae.map.service.dto.result.cctv.CctvResult;
import java.math.BigDecimal;

// purpose는 API 코드, purposeName은 공공데이터 원본 설치목적이다.
// cameraPixels는 원본 단위 그대로다 (200 = 200만 화소). 화소수와 보관일수는 정보가 없으면 null이다.
public record CctvResponse(long id, BigDecimal latitude, BigDecimal longitude, int distanceMeters, String address,
                           String purpose, String purposeName, int cameraCount, Integer cameraPixels,
                           Integer retentionDays) {

    public static CctvResponse from(CctvResult result) {
        Cctv cctv = result.cctv();
        return new CctvResponse(cctv.getId(), cctv.getLatitude(), cctv.getLongitude(), result.distanceMeters(),
                cctv.getAddress(), cctv.getPurpose().name(), cctv.getPurpose().getSourceName(), cctv.getCameraCount(),
                cctv.getCameraPixels(), cctv.getRetentionDays());
    }
}
