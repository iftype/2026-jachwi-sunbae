package com.jachwisunbae.map.service.dto.result.cctv;

import java.math.BigDecimal;
import java.util.List;

public record CctvsResult(BigDecimal latitude, BigDecimal longitude, int radius, List<CctvResult> cctvs) {
}
