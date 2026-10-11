package com.jachwisunbae.map.service.goodprice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.map.domain.CoordinateBounds;
import com.jachwisunbae.map.domain.GeoDistance;
import com.jachwisunbae.map.domain.goodprice.GoodPriceStore;
import com.jachwisunbae.map.service.dto.result.goodprice.GoodPriceStoreResult;
import com.jachwisunbae.map.service.dto.result.goodprice.GoodPriceStoresResult;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class GoodPriceStoreServiceTest {

    private static final BigDecimal LATITUDE = new BigDecimal("37.3940000");
    private static final BigDecimal LONGITUDE = new BigDecimal("127.1090000");
    private static final LocalDate SOURCE_DATE = LocalDate.of(2026, 6, 30);

    @Test
    @DisplayName("요청 반경을 감싸는 사각형으로 후보를 조회한다")
    void requestsCandidatesWithinBounds() {
        List<CoordinateBounds> requested = new ArrayList<>();
        GoodPriceStoreService service = new GoodPriceStoreService(bounds -> {
            requested.add(bounds);
            return List.of();
        });

        service.nearby(LATITUDE, LONGITUDE, 1000);

        assertThat(requested).singleElement().usingRecursiveComparison()
                .isEqualTo(CoordinateBounds.around(LATITUDE, LONGITUDE, 1000));
    }

    @Test
    @DisplayName("사각형 모서리에 있지만 실제 반경 밖인 업소는 제외한다")
    void excludesStoresOutsideRadius() {
        CoordinateBounds bounds = CoordinateBounds.around(LATITUDE, LONGITUDE, 500);
        GoodPriceStore inside = store(1L, "37.3950000", "127.1090000");
        GoodPriceStore corner = store(2L, bounds.getMaxLatitude().toPlainString(),
                bounds.getMaxLongitude().toPlainString());
        GoodPriceStoreService service = new GoodPriceStoreService(ignored -> List.of(inside, corner));

        GoodPriceStoresResult result = service.nearby(LATITUDE, LONGITUDE, 500);

        assertThat(result.stores()).extracting(GoodPriceStoreResult::store).containsExactly(inside);
    }

    @Test
    @DisplayName("가까운 순으로 정렬하고 거리가 같으면 ID 순으로 정렬한다")
    void sortsByDistance() {
        GoodPriceStore far = store(1L, "37.3980000", "127.1090000");
        GoodPriceStore nearSecond = store(3L, "37.3950000", "127.1090000");
        GoodPriceStore nearFirst = store(2L, "37.3950000", "127.1090000");
        GoodPriceStoreService service = new GoodPriceStoreService(ignored -> List.of(far, nearSecond, nearFirst));

        GoodPriceStoresResult result = service.nearby(LATITUDE, LONGITUDE, 1000);

        assertThat(result.stores()).extracting(storeResult -> storeResult.store().getId())
                .containsExactly(2L, 3L, 1L);
    }

    @Test
    @DisplayName("반경 안의 업소를 개수 제한 없이 모두 반환한다")
    void returnsAllStoresWithinRadius() {
        List<GoodPriceStore> stores = new ArrayList<>();
        for (long id = 1; id <= 100; id++) {
            stores.add(store(id, "37.3940000", "127.1090000"));
        }
        GoodPriceStoreService service = new GoodPriceStoreService(ignored -> stores);

        assertThat(service.nearby(LATITUDE, LONGITUDE, 500).stores()).hasSize(100);
    }

    @Test
    @DisplayName("거리는 GeoDistance로 계산해 미터 단위 정수로 반올림한다")
    void calculatesDistanceWithGeoDistance() {
        GoodPriceStore store = store(1L, "37.3950000", "127.1100000");
        GoodPriceStoreService service = new GoodPriceStoreService(ignored -> List.of(store));

        GoodPriceStoresResult result = service.nearby(LATITUDE, LONGITUDE, 500);

        long expected = Math.round(GeoDistance.meters(LATITUDE, LONGITUDE, store.getLatitude(), store.getLongitude()));
        assertThat(result.stores()).singleElement()
                .extracting(GoodPriceStoreResult::distanceMeters)
                .isEqualTo((int) expected);
    }

    @Test
    @DisplayName("요청 조건과 공공데이터 기준일을 함께 반환한다")
    void returnsQueryAndDataAsOf() {
        GoodPriceStoreService service = new GoodPriceStoreService(
                ignored -> List.of(store(1L, "37.3950000", "127.1090000")));

        GoodPriceStoresResult result = service.nearby(LATITUDE, LONGITUDE, 2000);

        assertThat(result.latitude()).isEqualTo(LATITUDE);
        assertThat(result.longitude()).isEqualTo(LONGITUDE);
        assertThat(result.radius()).isEqualTo(2000);
        assertThat(result.dataAsOf()).isEqualTo(SOURCE_DATE);
    }

    @Test
    @DisplayName("반경 안에 업소가 없으면 빈 목록과 기준일 없음을 반환한다")
    void returnsEmptyResult() {
        GoodPriceStoreService service = new GoodPriceStoreService(ignored -> List.of());

        GoodPriceStoresResult result = service.nearby(LATITUDE, LONGITUDE, 500);

        assertThat(result.stores()).isEmpty();
        assertThat(result.dataAsOf()).isNull();
    }

    @Test
    @DisplayName("좌표나 반경이 허용 범위를 벗어나면 사용자 입력 오류로 본다")
    void rejectsInvalidQuery() {
        GoodPriceStoreService service = new GoodPriceStoreService(ignored -> List.of());

        assertInvalidQuery(() -> service.nearby(null, LONGITUDE, 500));
        assertInvalidQuery(() -> service.nearby(new BigDecimal("90.1"), LONGITUDE, 500));
        assertInvalidQuery(() -> service.nearby(LATITUDE, new BigDecimal("-180.1"), 500));
        assertInvalidQuery(() -> service.nearby(LATITUDE, LONGITUDE, 700));
    }

    private static void assertInvalidQuery(ThrowingCallable call) {
        assertThatThrownBy(call)
                .isInstanceOfSatisfying(InvalidInputException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.MAP_QUERY_INVALID));
    }

    private static GoodPriceStore store(Long id, String latitude, String longitude) {
        return GoodPriceStore.reconstruct(id, "경기도", "성남시", "한식", "식당" + id, null, "경기도 성남시 분당구 판교역로 1",
                new BigDecimal(latitude), new BigDecimal(longitude), List.of(), SOURCE_DATE);
    }
}
