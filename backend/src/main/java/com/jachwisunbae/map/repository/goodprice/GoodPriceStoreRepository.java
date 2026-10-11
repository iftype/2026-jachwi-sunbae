package com.jachwisunbae.map.repository.goodprice;

import com.jachwisunbae.map.domain.CoordinateBounds;
import com.jachwisunbae.map.domain.goodprice.GoodPriceStore;
import java.util.List;

public interface GoodPriceStoreRepository {

    // 사각형 안의 후보만 조회한다. 실제 반경 판정과 거리 정렬은 호출하는 쪽에서 한다.
    List<GoodPriceStore> findAllWithin(CoordinateBounds bounds);
}
