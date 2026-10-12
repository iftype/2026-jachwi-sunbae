package com.jachwisunbae.map.provider.demo;

import com.jachwisunbae.map.domain.NearbyPlace;
import com.jachwisunbae.map.provider.NearbyPlaceProvider;
import com.jachwisunbae.map.type.MapCategory;
import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "map.nearby.provider", havingValue = "demo", matchIfMissing = true)
public class DemoNearbyPlaceProvider implements NearbyPlaceProvider {

    @Override
    public List<NearbyPlace> nearby(BigDecimal latitude, BigDecimal longitude, int radius,
                                    Set<MapCategory> categories) {
        List<NearbyPlace> places = List.of(
                place("demo-hospital-1", "서울시립병원", MapCategory.HOSPITAL,
                        latitude, longitude, 320, "서울 중구 세종대로 92"),
                place("demo-hospital-2", "우리의원", MapCategory.HOSPITAL,
                        latitude, longitude, 740, "서울 중구 무교로 12"),
                place("demo-school-1", "덕수초등학교", MapCategory.SCHOOL,
                        latitude, longitude, 830, "서울 중구 덕수궁길 140"),
                place("demo-school-2", "세종초등학교", MapCategory.SCHOOL,
                        latitude, longitude, 340, "서울 중구 세종대로 76"),
                place("demo-convenience-1", "모카 편의점", MapCategory.CONVENIENCE,
                        latitude, longitude, 180, "서울 중구 세종대로 100"),
                place("demo-convenience-2", "24시 편의점", MapCategory.CONVENIENCE,
                        latitude, longitude, 620, "서울 중구 을지로 12"),
                place("demo-agency-1", "자취선배 공인중개사", MapCategory.AGENCY,
                        latitude, longitude, 510, "서울 중구 다동길 8"),
                place("demo-agency-2", "세종대로 공인중개사", MapCategory.AGENCY,
                        latitude, longitude, 260, "서울 중구 세종대로 104")
        );
        return places.stream()
                .filter(place -> place.distanceMeters() <= radius && categories.contains(place.category()))
                .toList();
    }

    private NearbyPlace place(String id, String name, MapCategory category, BigDecimal latitude,
                              BigDecimal longitude, int distance, String address) {
        BigDecimal offset = BigDecimal.valueOf(distance).movePointLeft(6);
        return new NearbyPlace(id, name, category, address, latitude.add(offset), longitude.add(offset), distance);
    }
}
