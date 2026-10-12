package com.jachwisunbae.map.service.dto.result.cctv;

import com.jachwisunbae.map.domain.cctv.Cctv;

// 기준 좌표에서 CCTV까지의 거리(m)를 함께 담는다.
public record CctvResult(Cctv cctv, int distanceMeters) {
}
