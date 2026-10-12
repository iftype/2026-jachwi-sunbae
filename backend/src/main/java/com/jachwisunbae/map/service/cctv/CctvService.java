package com.jachwisunbae.map.service.cctv;

import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.map.domain.CoordinateBounds;
import com.jachwisunbae.map.domain.cctv.Cctv;
import com.jachwisunbae.map.repository.cctv.CctvRepository;
import com.jachwisunbae.map.service.dto.result.cctv.CctvResult;
import com.jachwisunbae.map.service.dto.result.cctv.CctvsResult;
import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class CctvService {

    private static final Set<Integer> SUPPORTED_RADII = Set.of(500, 1000, 2000);
    private final CctvRepository cctvRepository;

    public CctvService(CctvRepository cctvRepository) {
        this.cctvRepository = cctvRepository;
    }

    // 사각형으로 후보를 좁힌 뒤 실제 거리로 사각형 모서리 부분을 걸러 내고 가까운 순으로 정렬한다.
    // 반경 비교는 반올림 전 거리로 해서, 사각형과 같은 기준으로 경계를 판단한다.
    // 반경 안의 CCTV는 설치목적과 관계없이, 같은 좌표여도 합치지 않고, 개수 제한 없이 모두 반환한다.
    public CctvsResult nearby(BigDecimal latitude, BigDecimal longitude, int radius) {
        validateQuery(latitude, longitude, radius);
        CoordinateBounds bounds = CoordinateBounds.around(latitude, longitude, radius);
        List<CctvResult> cctvs = cctvRepository.findAllWithin(bounds).stream()
                .map(cctv -> new Candidate(cctv, cctv.distanceMetersFrom(latitude, longitude)))
                .filter(candidate -> candidate.distanceMeters() <= radius)
                .sorted(Comparator.comparingDouble(Candidate::distanceMeters)
                        .thenComparing(candidate -> candidate.cctv().getId()))
                .map(Candidate::toResult)
                .toList();
        return new CctvsResult(latitude, longitude, radius, cctvs);
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

    private record Candidate(Cctv cctv, double distanceMeters) {

        private CctvResult toResult() {
            return new CctvResult(cctv, (int) Math.round(distanceMeters));
        }
    }
}
