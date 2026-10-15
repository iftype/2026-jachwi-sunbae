package com.jachwisunbae.map.provider;

import com.jachwisunbae.map.domain.NearbyPlace;
import com.jachwisunbae.map.type.MapCategory;
import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

// 주변 시설을 조회한다. 버스정류장은 서비스 DB에서 조회하므로 BusStopService가 맡는다.
public interface NearbyPlaceProvider {
    List<NearbyPlace> nearby(BigDecimal latitude, BigDecimal longitude, int radius, Set<MapCategory> categories);
}
