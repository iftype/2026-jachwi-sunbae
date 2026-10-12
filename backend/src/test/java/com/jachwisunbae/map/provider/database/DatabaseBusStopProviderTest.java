package com.jachwisunbae.map.provider.database;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import com.jachwisunbae.map.domain.BusStop;
import com.jachwisunbae.map.domain.CoordinateBounds;
import com.jachwisunbae.map.domain.GeoDistance;
import com.jachwisunbae.map.domain.NearbyPlace;
import com.jachwisunbae.map.repository.BusStopRepository;
import com.jachwisunbae.map.type.MapCategory;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class DatabaseBusStopProviderTest {

    private static final BigDecimal LATITUDE = new BigDecimal("37.3948000");
    private static final BigDecimal LONGITUDE = new BigDecimal("127.1119000");

    private final List<BusStop> busStops = new ArrayList<>();
    private DatabaseBusStopProvider provider;

    @BeforeEach
    void setUp() {
        BusStopRepository repository = bounds -> busStops.stream()
                .filter(busStop -> contains(bounds, busStop))
                .toList();
        provider = new DatabaseBusStopProvider(repository);
    }

    @ParameterizedTest
    @CsvSource({"500, 1", "1000, 2", "2000, 3"})
    @DisplayName("선택한 반경 안의 정류장만 조회한다")
    void findsBusStopsWithinRadius(int radius, int expectedCount) {
        addNorth("STOP_400", 400);
        addNorth("STOP_900", 900);
        addNorth("STOP_1900", 1900);
        addNorth("STOP_2100", 2100);

        assertThat(provider.nearby(LATITUDE, LONGITUDE, radius)).hasSize(expectedCount);
    }

    @Test
    @DisplayName("사각형 모서리에 있어 반경을 벗어난 정류장은 제외한다")
    void excludesBusStopsInBoundsCorner() {
        CoordinateBounds bounds = CoordinateBounds.around(LATITUDE, LONGITUDE, 500);
        busStops.add(busStop("CORNER", bounds.getMaxLatitude(), bounds.getMaxLongitude()));

        assertThat(provider.nearby(LATITUDE, LONGITUDE, 500)).isEmpty();
    }

    @Test
    @DisplayName("반경 경계 바로 안쪽의 정류장은 포함한다")
    void includesBusStopJustInsideRadius() {
        addNorth("EDGE", 499.9);

        assertThat(provider.nearby(LATITUDE, LONGITUDE, 500))
                .extracting(NearbyPlace::distanceMeters)
                .containsExactly(500);
    }

    @Test
    @DisplayName("가까운 순으로 정렬하고 거리가 같으면 정류장 ID 순으로 정렬한다")
    void sortsByDistanceThenNodeId() {
        addNorth("FAR", 300);
        addNorth("NEAR_B", 100);
        addNorth("NEAR_A", 100);

        assertThat(provider.nearby(LATITUDE, LONGITUDE, 500))
                .extracting(NearbyPlace::providerPlaceId)
                .containsExactly("tago:31020:NEAR_A", "tago:31020:NEAR_B", "tago:31020:FAR");
    }

    @Test
    @DisplayName("정류장을 TAGO와 같은 ID 규칙의 교통 시설로 바꾼다")
    void convertsBusStopToTransportPlace() {
        busStops.add(BusStop.reconstruct("GGB206000001", "판교역", new BigDecimal("37.3948000"),
                new BigDecimal("127.1119000"), "31020"));

        assertThat(provider.nearby(LATITUDE, LONGITUDE, 500))
                .extracting(NearbyPlace::providerPlaceId, NearbyPlace::name, NearbyPlace::category,
                        NearbyPlace::address, NearbyPlace::distanceMeters)
                .containsExactly(tuple("tago:31020:GGB206000001", "판교역", MapCategory.TRANSPORT, "버스정류소", 0));
    }

    private void addNorth(String nodeId, double meters) {
        BigDecimal latitude = LATITUDE.add(BigDecimal.valueOf(
                Math.toDegrees(meters / GeoDistance.EARTH_RADIUS_METERS))).setScale(7, RoundingMode.HALF_UP);
        busStops.add(busStop(nodeId, latitude, LONGITUDE));
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
