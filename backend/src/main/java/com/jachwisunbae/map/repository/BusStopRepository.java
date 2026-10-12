package com.jachwisunbae.map.repository;

import com.jachwisunbae.map.domain.BusStop;
import com.jachwisunbae.map.domain.CoordinateBounds;
import java.util.List;

public interface BusStopRepository {

    // 승객이 타고 내릴 수 없는 정류장(미정차, 가상 정류장)은 제외한다.
    List<BusStop> findAllWithin(CoordinateBounds bounds);
}
