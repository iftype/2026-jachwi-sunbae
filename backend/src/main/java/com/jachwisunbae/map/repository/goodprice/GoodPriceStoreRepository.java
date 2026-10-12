package com.jachwisunbae.map.repository.goodprice;

import com.jachwisunbae.map.domain.CoordinateBounds;
import com.jachwisunbae.map.domain.goodprice.GoodPriceStore;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface GoodPriceStoreRepository {

    // 사각형 안의 후보만 조회한다. 실제 반경 판정과 거리 정렬은 호출하는 쪽에서 한다.
    List<GoodPriceStore> findAllWithin(CoordinateBounds bounds);

    // 적재된 공공데이터의 기준일. 조회 반경과 관계없는 데이터 전체의 값이며, 적재 전이라 비어 있으면 빈 값이다.
    Optional<LocalDate> findLatestSourceDate();
}
