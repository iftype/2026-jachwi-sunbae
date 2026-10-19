package com.jachwisunbae.map.service.busstop;

import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.map.domain.CoordinateBounds;
import com.jachwisunbae.map.domain.busstop.BusStop;
import com.jachwisunbae.map.repository.busstop.BusStopRepository;
import com.jachwisunbae.map.service.dto.result.busstop.BusStopResult;
import com.jachwisunbae.map.service.dto.result.busstop.BusStopsResult;
import java.math.BigDecimal;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;

// 서비스 DB에 적재한 전국 버스정류장에서 반경 안의 정류장을 찾는다. 외부 API를 호출하지 않는다.
@Service
public class BusStopService {

    private static final Set<Integer> SUPPORTED_RADII = Set.of(500, 1000, 2000);
    private final BusStopRepository busStopRepository;

    public BusStopService(BusStopRepository busStopRepository) {
        this.busStopRepository = busStopRepository;
    }

    // 사각형으로 후보를 좁힌 뒤 실제 거리로 사각형 모서리 부분을 걸러 내고 가까운 순으로 정렬한다.
    // 반경 비교는 반올림 전 거리로 해서, 사각형과 같은 기준으로 경계를 판단한다.
    // 여러 기관이 등록한 같은 정류장(정류소 ID가 같은 정류장)은 가장 가까운 하나만 남긴다.
    public BusStopsResult nearby(BigDecimal latitude, BigDecimal longitude, int radius) {
        validateQuery(latitude, longitude, radius);
        CoordinateBounds bounds = CoordinateBounds.around(latitude, longitude, radius);
        List<Candidate> candidates = busStopRepository.findAllWithin(bounds).stream()
                .map(busStop -> new Candidate(busStop, busStop.distanceMetersFrom(latitude, longitude)))
                .filter(candidate -> candidate.distanceMeters() <= radius)
                .sorted(Comparator.comparingDouble(Candidate::distanceMeters)
                        .thenComparing(candidate -> candidate.busStop().getNodeId()))
                .toList();
        return new BusStopsResult(latitude, longitude, radius, nearestPerStation(candidates));
    }

    private List<BusStopResult> nearestPerStation(List<Candidate> sortedCandidates) {
        Set<String> stationIds = new HashSet<>();
        return sortedCandidates.stream()
                .filter(candidate -> stationIds.add(candidate.busStop().getStationId()))
                .map(Candidate::toResult)
                .toList();
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

    private record Candidate(BusStop busStop, double distanceMeters) {

        private BusStopResult toResult() {
            return new BusStopResult(busStop, (int) Math.round(distanceMeters));
        }
    }
}
