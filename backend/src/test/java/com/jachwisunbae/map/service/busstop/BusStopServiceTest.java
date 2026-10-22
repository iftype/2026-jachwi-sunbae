package com.jachwisunbae.map.service.busstop;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.map.domain.CoordinateBounds;
import com.jachwisunbae.map.domain.GeoDistance;
import com.jachwisunbae.map.domain.busstop.BusStop;
import com.jachwisunbae.map.repository.busstop.BusStopRepository;
import com.jachwisunbae.map.service.dto.result.busstop.BusStopResult;
import com.jachwisunbae.map.service.dto.result.busstop.BusStopsResult;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class BusStopServiceTest {

    private static final BigDecimal LATITUDE = new BigDecimal("37.3948000");
    private static final BigDecimal LONGITUDE = new BigDecimal("127.1119000");

    private final List<BusStop> busStops = new ArrayList<>();
    private BusStopService service;

    @BeforeEach
    void setUp() {
        BusStopRepository repository = bounds -> busStops.stream()
                .filter(busStop -> contains(bounds, busStop))
                .toList();
        service = new BusStopService(repository);
    }

    @ParameterizedTest
    @CsvSource({"500, 1", "1000, 2", "2000, 3"})
    @DisplayName("선택한 반경 안의 정류장만 조회한다")
    void findsBusStopsWithinRadius(int radius, int expectedCount) {
        addNorth("STOP_400", 400);
        addNorth("STOP_900", 900);
        addNorth("STOP_1900", 1900);
        addNorth("STOP_2100", 2100);

        assertThat(service.nearby(LATITUDE, LONGITUDE, radius).busStops()).hasSize(expectedCount);
    }

    @Test
    @DisplayName("사각형 모서리에 있어 반경을 벗어난 정류장은 제외한다")
    void excludesBusStopsInBoundsCorner() {
        CoordinateBounds bounds = CoordinateBounds.around(LATITUDE, LONGITUDE, 500);
        busStops.add(busStop("CORNER", bounds.getMaxLatitude(), bounds.getMaxLongitude()));

        assertThat(service.nearby(LATITUDE, LONGITUDE, 500).busStops()).isEmpty();
    }

    @Test
    @DisplayName("반경 경계 바로 안쪽의 정류장은 포함한다")
    void includesBusStopJustInsideRadius() {
        addNorth("EDGE", 499.9);

        assertThat(service.nearby(LATITUDE, LONGITUDE, 500).busStops())
                .extracting(BusStopResult::distanceMeters)
                .containsExactly(500);
    }

    @Test
    @DisplayName("가까운 순으로 정렬하고 거리가 같으면 정류장 ID 순으로 정렬한다")
    void sortsByDistanceThenNodeId() {
        addNorth("FAR", 300);
        addNorth("NEAR_B", 100);
        addNorth("NEAR_A", 100);

        assertThat(service.nearby(LATITUDE, LONGITUDE, 500).busStops())
                .extracting(result -> result.busStop().getNodeId())
                .containsExactly("NEAR_A", "NEAR_B", "FAR");
    }

    @Test
    @DisplayName("여러 기관이 등록한 같은 정류장은 가장 가까운 하나만 남긴다")
    void keepsNearestOfSameStation() {
        addNorth("SEB204000159", "벤처타운(북문)", 24);
        addNorth("GGB204000159", "벤처타운(북문)", 29);
        addNorth("GGB204000163", "벤처타운(남문)", 81);
        addNorth("SEB204000163", "벤처타운(남문)", 87);

        assertThat(service.nearby(LATITUDE, LONGITUDE, 500).busStops())
                .extracting(stop -> stop.busStop().getNodeId())
                .containsExactly("SEB204000159", "GGB204000163");
    }

    @Test
    @DisplayName("같은 정류장의 거리가 같으면 정류장 ID 순으로 앞선 하나를 남긴다")
    void keepsFirstNodeIdOfSameStationAtSameDistance() {
        addNorth("SEB204000159", "벤처타운(북문)", 24);
        addNorth("GGB204000159", "벤처타운(북문)", 24);

        assertThat(service.nearby(LATITUDE, LONGITUDE, 500).busStops())
                .extracting(stop -> stop.busStop().getNodeId())
                .containsExactly("GGB204000159");
    }

    @Test
    @DisplayName("이름이 같아도 정류소 ID가 다르면 다른 정류장으로 본다")
    void keepsSameNameWithDifferentStationId() {
        addNorth("GGB204000286", "금토교회앞", 354);
        addNorth("GGB204000285", "금토교회앞", 361);

        assertThat(service.nearby(LATITUDE, LONGITUDE, 500).busStops())
                .extracting(stop -> stop.busStop().getNodeId())
                .containsExactly("GGB204000286", "GGB204000285");
    }

    @Test
    @DisplayName("요청 반경을 감싸는 사각형으로 후보를 조회한다")
    void requestsCandidatesWithinBounds() {
        List<CoordinateBounds> requested = new ArrayList<>();
        BusStopService service = new BusStopService(bounds -> {
            requested.add(bounds);
            return List.of();
        });

        service.nearby(LATITUDE, LONGITUDE, 1000);

        assertThat(requested).singleElement().usingRecursiveComparison()
                .isEqualTo(CoordinateBounds.around(LATITUDE, LONGITUDE, 1000));
    }

    @Test
    @DisplayName("요청 조건과 정류장 정보를 함께 반환한다")
    void returnsQueryAndBusStop() {
        BusStop pangyo = BusStop.reconstruct("GGB206000001", "판교역", LATITUDE, LONGITUDE, "31020");
        busStops.add(pangyo);

        BusStopsResult result = service.nearby(LATITUDE, LONGITUDE, 2000);

        assertThat(result.latitude()).isEqualTo(LATITUDE);
        assertThat(result.longitude()).isEqualTo(LONGITUDE);
        assertThat(result.radius()).isEqualTo(2000);
        assertThat(result.busStops()).containsExactly(new BusStopResult(pangyo, 0));
    }

    @Test
    @DisplayName("좌표나 반경이 허용 범위를 벗어나면 사용자 입력 오류로 본다")
    void rejectsInvalidQuery() {
        assertInvalidQuery(() -> service.nearby(null, LONGITUDE, 500));
        assertInvalidQuery(() -> service.nearby(LATITUDE, null, 500));
        assertInvalidQuery(() -> service.nearby(new BigDecimal("90.1"), LONGITUDE, 500));
        assertInvalidQuery(() -> service.nearby(LATITUDE, new BigDecimal("-180.1"), 500));
        assertInvalidQuery(() -> service.nearby(LATITUDE, LONGITUDE, 700));
    }

    private static void assertInvalidQuery(ThrowingCallable call) {
        assertThatThrownBy(call)
                .isInstanceOfSatisfying(InvalidInputException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.MAP_QUERY_INVALID));
    }

    private void addNorth(String nodeId, double meters) {
        addNorth(nodeId, nodeId, meters);
    }

    private void addNorth(String nodeId, String name, double meters) {
        BigDecimal latitude = LATITUDE.add(BigDecimal.valueOf(
                Math.toDegrees(meters / GeoDistance.EARTH_RADIUS_METERS))).setScale(7, RoundingMode.HALF_UP);
        busStops.add(BusStop.reconstruct(nodeId, name, latitude, LONGITUDE, "31020"));
    }

    private BusStop busStop(String nodeId, BigDecimal latitude, BigDecimal longitude) {
        return BusStop.reconstruct(nodeId, nodeId, latitude, longitude, "31020");
    }

    private boolean contains(CoordinateBounds bounds, BusStop busStop) {
        return busStop.getLatitude().compareTo(bounds.getMinLatitude()) >= 0
                && busStop.getLatitude().compareTo(bounds.getMaxLatitude()) <= 0
                && busStop.getLongitude().compareTo(bounds.getMinLongitude()) >= 0
                && busStop.getLongitude().compareTo(bounds.getMaxLongitude()) <= 0;
    }
}
