package com.jachwisunbae.map.service.dto.result.agency;

import com.jachwisunbae.map.domain.agency.Agency;
import java.math.BigDecimal;
import java.util.List;

public record AgenciesResult(BigDecimal latitude, BigDecimal longitude, int radius, List<Agency> agencies) {
}
