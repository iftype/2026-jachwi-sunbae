package com.jachwisunbae.map.service.goodprice;

import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.map.domain.CoordinateBounds;
import com.jachwisunbae.map.domain.goodprice.GoodPriceStore;
import com.jachwisunbae.map.repository.goodprice.GoodPriceStoreRepository;
import com.jachwisunbae.map.service.dto.result.goodprice.GoodPriceStoreResult;
import com.jachwisunbae.map.service.dto.result.goodprice.GoodPriceStoresResult;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class GoodPriceStoreService {

    private static final Set<Integer> SUPPORTED_RADII = Set.of(500, 1000, 2000);
    private final GoodPriceStoreRepository goodPriceStoreRepository;

    public GoodPriceStoreService(GoodPriceStoreRepository goodPriceStoreRepository) {
        this.goodPriceStoreRepository = goodPriceStoreRepository;
    }

    // 사각형으로 후보를 좁힌 뒤 실제 거리로 사각형 모서리 부분을 걸러 내고 가까운 순으로 정렬한다.
    // 반경 비교는 반올림 전 거리로 해서, 사각형과 같은 기준으로 경계를 판단한다.
    // 반경 안의 업소는 개수 제한 없이 모두 반환한다.
    public GoodPriceStoresResult nearby(BigDecimal latitude, BigDecimal longitude, int radius) {
        validateQuery(latitude, longitude, radius);
        CoordinateBounds bounds = CoordinateBounds.around(latitude, longitude, radius);
        List<Candidate> candidates = goodPriceStoreRepository.findAllWithin(bounds).stream()
                .map(store -> new Candidate(store, store.distanceMetersFrom(latitude, longitude)))
                .filter(candidate -> candidate.distanceMeters() <= radius)
                .sorted(Comparator.comparingDouble(Candidate::distanceMeters)
                        .thenComparing(candidate -> candidate.store().getId()))
                .toList();
        return new GoodPriceStoresResult(latitude, longitude, radius, dataAsOf(),
                candidates.stream().map(Candidate::toResult).toList());
    }

    // 기준일은 조회 결과가 아니라 적재된 공공데이터 전체의 값이라, 반경 안에 업소가 없어도 내려준다.
    // 적재할 때마다 전체를 다시 채우므로 모든 업소의 기준일이 같다. 혹시 섞여 있으면 가장 최근 값을 쓴다.
    // 테이블이 비어 있을 때(적재 전)만 null이다.
    private LocalDate dataAsOf() {
        return goodPriceStoreRepository.findLatestSourceDate().orElse(null);
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

    private record Candidate(GoodPriceStore store, double distanceMeters) {

        private GoodPriceStoreResult toResult() {
            return new GoodPriceStoreResult(store, (int) Math.round(distanceMeters));
        }
    }
}
