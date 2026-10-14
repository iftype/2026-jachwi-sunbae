package com.jachwisunbae.map.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.map.domain.NearbyPlace;
import com.jachwisunbae.map.provider.NearbyPlaceProvider;
import com.jachwisunbae.map.provider.demo.DemoAddressProvider;
import com.jachwisunbae.map.service.dto.result.NearbyResult;
import com.jachwisunbae.map.type.MapCategory;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class MapServiceTest {

    private static final BigDecimal LATITUDE = new BigDecimal("37.406");
    private static final BigDecimal LONGITUDE = new BigDecimal("127.088");

    private final NearbyPlace hospital = place("kakao:2", "판교병원", MapCategory.HOSPITAL);
    private final NearbyPlace school = place("kakao:3", "판교초등학교", MapCategory.SCHOOL);

    @Test
    @DisplayName("주변 시설 공급자의 결과를 그대로 반환하고 모든 카테고리의 개수를 집계한다")
    void countsEveryCategory() {
        MapService service = service((latitude, longitude, radius, categories) -> List.of(hospital, school));

        NearbyResult response = service.nearby(LATITUDE, LONGITUDE, 500, EnumSet.allOf(MapCategory.class));

        assertThat(response.places()).containsExactly(hospital, school);
        assertThat(response.counts())
                .containsOnlyKeys(EnumSet.allOf(MapCategory.class))
                .containsEntry(MapCategory.HOSPITAL, 1)
                .containsEntry(MapCategory.SCHOOL, 1)
                .containsEntry(MapCategory.CONVENIENCE, 0)
                .containsEntry(MapCategory.AGENCY, 0);
    }

    @Test
    @DisplayName("같은 조건으로 다시 조회해도 저장된 결과 없이 공급자를 매번 호출한다")
    void requestsNearbyProviderEveryTime() {
        AtomicInteger nearbyCalls = new AtomicInteger();
        MapService service = service((latitude, longitude, radius, categories) -> {
            nearbyCalls.incrementAndGet();
            return List.of(hospital);
        });

        service.nearby(LATITUDE, LONGITUDE, 500, EnumSet.allOf(MapCategory.class));
        service.nearby(LATITUDE, LONGITUDE, 500, EnumSet.allOf(MapCategory.class));

        assertThat(nearbyCalls).hasValue(2);
    }

    @Test
    @DisplayName("요청 카테고리가 없으면 전체 카테고리를 주변 시설 공급자에 요청한다")
    void requestsAllCategoriesWhenCategoriesAreMissing() {
        List<Set<MapCategory>> requested = new ArrayList<>();
        MapService service = service((latitude, longitude, radius, categories) -> {
            requested.add(categories);
            return List.of();
        });

        service.nearby(LATITUDE, LONGITUDE, 500, null);
        service.nearby(LATITUDE, LONGITUDE, 500, Set.of());

        EnumSet<MapCategory> all = EnumSet.allOf(MapCategory.class);
        assertThat(requested).containsExactly(all, all);
    }

    @Test
    @DisplayName("요청 카테고리의 빈 값은 무시한다")
    void ignoresNullCategories() {
        List<Set<MapCategory>> requested = new ArrayList<>();
        MapService service = service((latitude, longitude, radius, categories) -> {
            requested.add(categories);
            return List.of();
        });
        Set<MapCategory> categoriesWithNull = new HashSet<>();
        categoriesWithNull.add(MapCategory.HOSPITAL);
        categoriesWithNull.add(null);

        service.nearby(LATITUDE, LONGITUDE, 500, categoriesWithNull);

        assertThat(requested).containsExactly(EnumSet.of(MapCategory.HOSPITAL));
    }

    @Test
    @DisplayName("검색어, 좌표, 반경이 허용 범위를 벗어나면 사용자 입력 오류로 본다")
    void rejectsInvalidQueryAsInvalidInput() {
        MapService service = service((latitude, longitude, radius, categories) -> List.of(hospital));

        assertInvalidQuery(() -> service.geocode(" "));
        assertInvalidQuery(() -> service.reverseGeocode(new BigDecimal("91"), LONGITUDE));
        assertInvalidQuery(() -> service.nearby(LATITUDE, LONGITUDE, 700, EnumSet.allOf(MapCategory.class)));
    }

    private static void assertInvalidQuery(ThrowingCallable call) {
        assertThatThrownBy(call)
                .isInstanceOfSatisfying(InvalidInputException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.MAP_QUERY_INVALID));
    }

    private MapService service(NearbyPlaceProvider nearbyPlaceProvider) {
        return new MapService(new DemoAddressProvider(), nearbyPlaceProvider);
    }

    private static NearbyPlace place(String id, String name, MapCategory category) {
        return new NearbyPlace(id, name, category, "경기 성남시 분당구", LATITUDE, LONGITUDE, 100);
    }
}
