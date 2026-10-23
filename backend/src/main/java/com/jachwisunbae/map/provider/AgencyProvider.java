package com.jachwisunbae.map.provider;

import com.jachwisunbae.map.domain.agency.Agency;
import java.math.BigDecimal;
import java.util.List;

// 반경 안의 중개업소를 가까운 순으로 조회한다.
public interface AgencyProvider {
    List<Agency> nearby(BigDecimal latitude, BigDecimal longitude, int radius);
}
