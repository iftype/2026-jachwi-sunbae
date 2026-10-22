package com.jachwisunbae.map.service.agency;

import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.map.provider.AgencyProvider;
import com.jachwisunbae.map.service.dto.result.agency.AgenciesResult;
import java.math.BigDecimal;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class AgencyService {

    private static final Set<Integer> SUPPORTED_RADII = Set.of(500, 1000, 2000);
    private final AgencyProvider agencyProvider;

    public AgencyService(AgencyProvider agencyProvider) {
        this.agencyProvider = agencyProvider;
    }

    // 공급자가 가까운 순으로 반환한 결과를 그대로 사용한다. 저장하지 않고 요청마다 공급자를 호출한다.
    public AgenciesResult nearby(BigDecimal latitude, BigDecimal longitude, int radius) {
        validateQuery(latitude, longitude, radius);
        return new AgenciesResult(latitude, longitude, radius, agencyProvider.nearby(latitude, longitude, radius));
    }

    private void validateQuery(BigDecimal latitude, BigDecimal longitude, int radius) {
        if (latitude == null || longitude == null
            || latitude.compareTo(BigDecimal.valueOf(-90)) < 0
            || latitude.compareTo(BigDecimal.valueOf(90)) > 0
            || longitude.compareTo(BigDecimal.valueOf(-180)) < 0
            || longitude.compareTo(BigDecimal.valueOf(180)) > 0) {
            throw new InvalidInputException(ErrorCode.MAP_QUERY_INVALID, "위도와 경도 범위가 올바르지 않습니다.");
        }
        if (!SUPPORTED_RADII.contains(radius)) {
            throw new InvalidInputException(ErrorCode.MAP_QUERY_INVALID, "반경은 500m, 1km, 2km만 사용할 수 있습니다.");
        }
    }
}
