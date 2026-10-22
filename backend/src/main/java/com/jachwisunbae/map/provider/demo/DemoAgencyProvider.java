package com.jachwisunbae.map.provider.demo;

import com.jachwisunbae.map.domain.agency.Agency;
import com.jachwisunbae.map.provider.AgencyProvider;
import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

// DemoNearbyPlaceProvider의 중개업소 2건과 같은 장소에 전화번호와 상세 페이지 URL 예시 값을 더한다.
@Component
@ConditionalOnProperty(name = "map.nearby.provider", havingValue = "demo", matchIfMissing = true)
public class DemoAgencyProvider implements AgencyProvider {

    @Override
    public List<Agency> nearby(BigDecimal latitude, BigDecimal longitude, int radius) {
        List<Agency> agencies = List.of(
                agency("demo-agency-1", "자취선배 공인중개사", latitude, longitude, 510, "서울 중구 다동길 8",
                        "02-1234-5678", "https://place.map.kakao.com/demo-agency-1"),
                agency("demo-agency-2", "세종대로 공인중개사", latitude, longitude, 260, "서울 중구 세종대로 104",
                        "02-2345-6789", "https://place.map.kakao.com/demo-agency-2")
        );
        return agencies.stream()
                .filter(agency -> agency.distanceMeters() <= radius)
                .sorted(Comparator.comparingInt(Agency::distanceMeters))
                .toList();
    }

    private Agency agency(String id, String name, BigDecimal latitude, BigDecimal longitude, int distance,
                          String address, String phone, String placeUrl) {
        BigDecimal offset = BigDecimal.valueOf(distance).movePointLeft(6);
        return new Agency(id, name, address, latitude.add(offset), longitude.add(offset), distance, phone, placeUrl);
    }
}
