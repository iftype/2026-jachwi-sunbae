package com.jachwisunbae.map.service;

import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.map.domain.MapAddress;
import com.jachwisunbae.map.domain.NearbyPlace;
import com.jachwisunbae.map.provider.AddressProvider;
import com.jachwisunbae.map.provider.BusStopProvider;
import com.jachwisunbae.map.provider.NearbyPlaceProvider;
import com.jachwisunbae.map.service.dto.result.NearbyResult;
import com.jachwisunbae.map.type.MapCategory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;


@Service
public class MapService {

    private static final Set<Integer> SUPPORTED_RADII = Set.of(500, 1000, 2000);
    private final AddressProvider addressProvider;
    private final NearbyPlaceProvider nearbyPlaceProvider;
    private final BusStopProvider busStopProvider;

    public MapService(AddressProvider addressProvider, NearbyPlaceProvider nearbyPlaceProvider,
                      BusStopProvider busStopProvider) {
        this.addressProvider = addressProvider;
        this.nearbyPlaceProvider = nearbyPlaceProvider;
        this.busStopProvider = busStopProvider;
    }

    public List<MapAddress> geocode(String query) {
        if (query == null || query.isBlank() || query.length() > 200) {
            throw invalidQuery("주소 검색어는 1자 이상 200자 이하여야 합니다.");
        }
        return addressProvider.geocode(query.trim());
    }

    public MapAddress reverseGeocode(BigDecimal latitude, BigDecimal longitude) {
        validateCoordinates(latitude, longitude);
        return addressProvider.reverseGeocode(latitude, longitude);
    }

    public NearbyResult nearby(BigDecimal latitude, BigDecimal longitude, int radius, Set<MapCategory> requestedCategories) {
        validateNearbyQuery(latitude, longitude, radius);
        Set<MapCategory> categories = categories(requestedCategories);

        List<NearbyPlace> places = findPlaces(latitude, longitude, radius, categories);
        Map<MapCategory, Integer> counts = new EnumMap<>(MapCategory.class);
        for (MapCategory category : MapCategory.values()) {
            counts.put(category, 0);
        }
        places.forEach(place -> counts.computeIfPresent(place.category(), (category, count) -> count + 1));
        return new NearbyResult(latitude, longitude, radius, Map.copyOf(counts), places);
    }

    private Set<MapCategory> categories(Set<MapCategory> requestedCategories) {
        EnumSet<MapCategory> categories = EnumSet.noneOf(MapCategory.class);
        if (requestedCategories != null) {
            requestedCategories.stream()
                .filter(Objects::nonNull)
                .forEach(categories::add);
        }
        return categories.isEmpty() ? EnumSet.allOf(MapCategory.class) : categories;
    }

    // 교통은 버스정류장으로만 구성하고, 나머지 카테고리는 주변 시설 공급자에서 조회한다.
    private List<NearbyPlace> findPlaces(BigDecimal latitude, BigDecimal longitude, int radius, Set<MapCategory> categories) {
        List<NearbyPlace> places = new ArrayList<>(findFacilities(latitude, longitude, radius, categories));
        if (categories.contains(MapCategory.TRANSPORT)) {
            places.addAll(busStopProvider.nearby(latitude, longitude, radius));
        }
        return List.copyOf(places);
    }

    private List<NearbyPlace> findFacilities(BigDecimal latitude, BigDecimal longitude, int radius,
                                             Set<MapCategory> categories) {
        EnumSet<MapCategory> facilityCategories = EnumSet.noneOf(MapCategory.class);
        facilityCategories.addAll(categories);
        facilityCategories.remove(MapCategory.TRANSPORT);
        if (facilityCategories.isEmpty()) {
            return List.of();
        }
        return nearbyPlaceProvider.nearby(latitude, longitude, radius, facilityCategories);
    }

    private void validateNearbyQuery(BigDecimal latitude, BigDecimal longitude, int radius) {
        validateCoordinates(latitude, longitude);
        if (!SUPPORTED_RADII.contains(radius)) {
            throw invalidQuery("반경은 500m, 1km, 2km만 사용할 수 있습니다.");
        }
    }

    private void validateCoordinates(BigDecimal latitude, BigDecimal longitude) {
        if (latitude == null || longitude == null
            || latitude.compareTo(BigDecimal.valueOf(-90)) < 0
            || latitude.compareTo(BigDecimal.valueOf(90)) > 0
            || longitude.compareTo(BigDecimal.valueOf(-180)) < 0
            || longitude.compareTo(BigDecimal.valueOf(180)) > 0) {
            throw invalidQuery("위도와 경도 범위가 올바르지 않습니다.");
        }
    }

    private InvalidInputException invalidQuery(String message) {
        return new InvalidInputException(ErrorCode.MAP_QUERY_INVALID, message);
    }
}
