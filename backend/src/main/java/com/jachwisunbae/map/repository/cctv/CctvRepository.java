package com.jachwisunbae.map.repository.cctv;

import com.jachwisunbae.map.domain.CoordinateBounds;
import com.jachwisunbae.map.domain.cctv.Cctv;
import com.jachwisunbae.map.domain.cctv.CctvPurpose;
import java.util.List;
import java.util.Set;

public interface CctvRepository {

    // 사각형 안에서 주어진 설치목적의 후보만 조회한다. 설치목적이 비어 있으면 빈 목록이다.
    // 실제 반경 판정과 거리 정렬은 호출하는 쪽에서 한다.
    List<Cctv> findAllWithin(CoordinateBounds bounds, Set<CctvPurpose> purposes);
}
