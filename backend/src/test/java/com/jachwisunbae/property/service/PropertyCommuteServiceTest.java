package com.jachwisunbae.property.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

import com.jachwisunbae.common.exception.client.BusinessRuleViolationException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.property.repository.PropertyRepository;
import com.jachwisunbae.property.repository.query.PropertyLocationQuery;
import com.jachwisunbae.property.service.dto.result.PropertyCommuteStatus;
import com.jachwisunbae.property.service.dto.result.PropertyCommuteTime;
import com.jachwisunbae.property.service.dto.result.PropertyCommuteTimes;
import com.jachwisunbae.transit.domain.GtfsEdge;
import com.jachwisunbae.transit.domain.GtfsRoute;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.network.TransitNetwork;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import com.jachwisunbae.transit.domain.vo.Seconds;
import com.jachwisunbae.transit.service.TransitNetworkCache;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PropertyCommuteServiceTest {

    // 목적지 바로 옆 정류장 A로 버스가 B → A로 들어오고, B에서 A까지 30분, C에서 B까지 40분 걸린다.
    private static final Coordinate DESTINATION = new Coordinate(37.5000, 127.0000);
    private static final long MEMBER_ID = 1L;

    private final PropertyRepository propertyRepository = mock(PropertyRepository.class);
    private final TransitNetworkCache transitNetworkCache = mock(TransitNetworkCache.class);
    private final PropertyCommuteService service = new PropertyCommuteService(propertyRepository,
            transitNetworkCache);

    @BeforeEach
    void setUp() {
        given(transitNetworkCache.get()).willReturn(new TransitNetwork(
                List.of(stop("A", 37.5000, 127.0010), stop("B", 37.5500, 127.0010), stop("C", 37.6000, 127.0010)),
                List.of(new GtfsRoute("R1", "1", "1번", 3, new Seconds(0))),
                List.of(new GtfsEdge("R1", "B", "A", new Seconds(1800)), new GtfsEdge("R1", "C", "B",
                        new Seconds(2400))),
                List.of()));
    }

    @Test
    @DisplayName("매물마다 통근 시간을 분으로 올림해 돌려주고, 위치가 없거나 60분을 넘는 매물은 상태로 알린다")
    void findsCommuteTimes() {
        given(propertyRepository.findLocationsByMemberId(MEMBER_ID)).willReturn(List.of(
                property(3L, "B 옆 집", 37.5500, 127.0012),
                property(2L, "위치 없는 집", null, null),
                property(1L, "C 옆 집", 37.6000, 127.0012)));

        PropertyCommuteTimes result = service.findCommuteTimes(MEMBER_ID, DESTINATION);

        assertThat(result.maxMinutes()).isEqualTo(60);
        assertThat(result.maxTransfers()).isEqualTo(2);
        assertThat(result.properties())
                .extracting(PropertyCommuteTime::propertyId, PropertyCommuteTime::status)
                .containsExactly(
                        tuple(3L, PropertyCommuteStatus.REACHABLE),
                        tuple(2L, PropertyCommuteStatus.NO_LOCATION),
                        tuple(1L, PropertyCommuteStatus.UNREACHABLE));
        assertThat(result.properties().get(0).commuteMinutes()).isEqualTo(32);
        assertThat(result.properties().get(1).commuteMinutes()).isNull();
        assertThat(result.properties().get(2).commuteMinutes()).isNull();
    }

    @Test
    @DisplayName("목적지에서 걸어서 10분 안에 정류장이 없으면 생활권 탐색과 같은 오류를 낸다")
    void rejectsDestinationWithoutArrivalStop() {
        assertThatThrownBy(() -> service.findCommuteTimes(MEMBER_ID, new Coordinate(35.0000, 129.0000)))
                .isInstanceOfSatisfying(BusinessRuleViolationException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.COMMUTE_DESTINATION_UNREACHABLE));
    }

    private static PropertyLocationQuery property(final long id, final String name, final Double latitude,
                                                  final Double longitude) {
        return new PropertyLocationQuery(id, name, latitude == null ? null : BigDecimal.valueOf(latitude),
                longitude == null ? null : BigDecimal.valueOf(longitude));
    }

    private static GtfsStop stop(final String stopId, final double latitude, final double longitude) {
        return new GtfsStop(stopId, stopId, new Coordinate(latitude, longitude));
    }
}
