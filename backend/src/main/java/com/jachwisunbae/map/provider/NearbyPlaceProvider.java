package com.jachwisunbae.map.provider;

import com.jachwisunbae.map.domain.NearbyPlace;
import com.jachwisunbae.map.type.MapCategory;
import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

// 교통(TRANSPORT)을 뺀 주변 시설을 조회한다. 교통은 BusStopProvider가 맡는다.
public interface NearbyPlaceProvider {
    List<NearbyPlace> nearby(BigDecimal latitude, BigDecimal longitude, int radius, Set<MapCategory> categories);
}
