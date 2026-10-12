package com.jachwisunbae.map.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.map.domain.NearbyPlace;
import com.jachwisunbae.map.provider.BusStopProvider;
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
    private static final BusStopProvider NO_BUS_STOPS = (latitude, longitude, radius) -> List.of();

    private final NearbyPlace hospital = place("kakao:2", "판교병원", MapCategory.HOSPITAL);
    private final NearbyPlace busStop = place("tago:31:1", "판교역 정류장", MapCategory.TRANSPORT);

    @Test
    @DisplayName("교통은 버스정류장으로만 채우고 주변 시설 결과와 합친다")
    void transportConsistsOfBusStopsOnly() {
        List<Set<MapCategory>> requested = new ArrayList<>();
        MapService service = new MapService(new DemoAddressProvider(), (latitude, longitude, radius, categories) -> {
            requested.add(categories);
            return List.of(hospital);
        }, (latitude, longitude, radius) -> List.of(busStop));

        NearbyResult response = service.nearby(LATITUDE, LONGITUDE, 500, EnumSet.allOf(MapCategory.class));

        assertThat(requested).containsExactly(EnumSet.complementOf(EnumSet.of(MapCategory.TRANSPORT)));
        assertThat(response.places()).containsExactly(hospital, busStop);
        assertThat(response.counts())
                .containsEntry(MapCategory.TRANSPORT, 1)
                .containsEntry(MapCategory.HOSPITAL, 1)
                .containsEntry(MapCategory.SCHOOL, 0);
    }

    @Test
    @DisplayName("교통만 요청하면 주변 시설 공급자를 호출하지 않는다")
    void transportOnlyDoesNotRequestNearbyProvider() {
        AtomicInteger nearbyCalls = new AtomicInteger();
        MapService service = new MapService(new DemoAddressProvider(), (latitude, longitude, radius, categories) -> {
            nearbyCalls.incrementAndGet();
            return List.of(hospital);
        }, (latitude, longitude, radius) -> List.of(busStop));

        NearbyResult response = service.nearby(LATITUDE, LONGITUDE, 500, EnumSet.of(MapCategory.TRANSPORT));

        assertThat(nearbyCalls).hasValue(0);
        assertThat(response.places()).containsExactly(busStop);
    }

    @Test
    @DisplayName("교통 카테고리가 없으면 버스정류장을 조회하지 않는다")
    void busStopsAreNotRequestedWithoutTransportCategory() {
        AtomicInteger busStopCalls = new AtomicInteger();
        MapService service = service((latitude, longitude, radius) -> {
            busStopCalls.incrementAndGet();
            return List.of(busStop);
        });

        NearbyResult response = service.nearby(LATITUDE, LONGITUDE, 500, EnumSet.of(MapCategory.HOSPITAL));

        assertThat(busStopCalls).hasValue(0);
        assertThat(response.places()).doesNotContain(busStop);
    }

    @Test
    @DisplayName("버스정류장 조회가 실패하면 대체 처리하지 않고 그대로 전파한다")
    void busStopFailureIsNotHidden() {
        MapService service = service((latitude, longitude, radius) -> {
            throw new IllegalStateException("버스정류장 조회 실패");
        });

        assertThatThrownBy(() -> service.nearby(LATITUDE, LONGITUDE, 500, EnumSet.allOf(MapCategory.class)))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("같은 조건으로 다시 조회해도 저장된 결과 없이 공급자를 매번 호출한다")
    void requestsNearbyProviderEveryTime() {
        AtomicInteger nearbyCalls = new AtomicInteger();
        NearbyPlaceProvider nearbyPlaceProvider = (latitude, longitude, radius, categories) -> {
            nearbyCalls.incrementAndGet();
            return List.of(hospital);
        };
        MapService service = new MapService(new DemoAddressProvider(), nearbyPlaceProvider, NO_BUS_STOPS);

        service.nearby(LATITUDE, LONGITUDE, 500, EnumSet.allOf(MapCategory.class));
        service.nearby(LATITUDE, LONGITUDE, 500, EnumSet.allOf(MapCategory.class));

        assertThat(nearbyCalls).hasValue(2);
    }

    @Test
    @DisplayName("요청 카테고리가 없으면 교통을 뺀 전체 카테고리를 주변 시설 공급자에 요청한다")
    void requestsAllCategoriesWhenCategoriesAreMissing() {
        List<Set<MapCategory>> requested = new ArrayList<>();
        MapService service = new MapService(new DemoAddressProvider(), (latitude, longitude, radius, categories) -> {
            requested.add(categories);
            return List.of();
        }, NO_BUS_STOPS);

        service.nearby(LATITUDE, LONGITUDE, 500, null);
        service.nearby(LATITUDE, LONGITUDE, 500, Set.of());

        EnumSet<MapCategory> facilities = EnumSet.complementOf(EnumSet.of(MapCategory.TRANSPORT));
        assertThat(requested).containsExactly(facilities, facilities);
    }

    @Test
    @DisplayName("요청 카테고리의 빈 값은 무시한다")
    void ignoresNullCategories() {
        List<Set<MapCategory>> requested = new ArrayList<>();
        MapService service = new MapService(new DemoAddressProvider(), (latitude, longitude, radius, categories) -> {
            requested.add(categories);
            return List.of();
        }, NO_BUS_STOPS);
        Set<MapCategory> categoriesWithNull = new HashSet<>();
        categoriesWithNull.add(MapCategory.HOSPITAL);
        categoriesWithNull.add(null);

        service.nearby(LATITUDE, LONGITUDE, 500, categoriesWithNull);

        assertThat(requested).containsExactly(EnumSet.of(MapCategory.HOSPITAL));
    }

    @Test
    @DisplayName("검색어, 좌표, 반경이 허용 범위를 벗어나면 사용자 입력 오류로 본다")
    void rejectsInvalidQueryAsInvalidInput() {
        MapService service = service(NO_BUS_STOPS);

        assertInvalidQuery(() -> service.geocode(" "));
        assertInvalidQuery(() -> service.reverseGeocode(new BigDecimal("91"), LONGITUDE));
        assertInvalidQuery(() -> service.nearby(LATITUDE, LONGITUDE, 700, EnumSet.allOf(MapCategory.class)));
    }

    private static void assertInvalidQuery(ThrowingCallable call) {
        assertThatThrownBy(call)
                .isInstanceOfSatisfying(InvalidInputException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.MAP_QUERY_INVALID));
    }

    private MapService service(BusStopProvider busStopProvider) {
        NearbyPlaceProvider nearbyPlaceProvider = (latitude, longitude, radius, categories) -> List.of(hospital);
        return new MapService(new DemoAddressProvider(), nearbyPlaceProvider, busStopProvider);
    }

    private static NearbyPlace place(String id, String name, MapCategory category) {
        return new NearbyPlace(id, name, category, "경기 성남시 분당구", LATITUDE, LONGITUDE, 100);
    }
}
