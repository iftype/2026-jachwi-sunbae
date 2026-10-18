package com.jachwisunbae.transit.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.common.exception.client.BusinessRuleViolationException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.ServiceUnavailableException;
import com.jachwisunbae.transit.domain.CommuteArea;
import com.jachwisunbae.transit.domain.GtfsEdge;
import com.jachwisunbae.transit.domain.GtfsFeed;
import com.jachwisunbae.transit.domain.GtfsRoute;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import com.jachwisunbae.transit.domain.vo.Seconds;
import com.jachwisunbae.transit.service.dto.result.CommuteAreaSearchResult;
import java.time.Clock;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CommuteAreaServiceTest {

    // 목적지 바로 옆 정류장 A(가까운동 11000002)로 버스 R1이 C(먼동 11000001) → B(먼동) → A 순서로 들어온다.
    // D는 행정동이 없다.
    private static final Coordinate DESTINATION = new Coordinate(37.5000, 127.0000);
    private static final String NEAR_DONG = "11000002";
    private static final String FAR_DONG = "11000001";
    private static final String INCHEON_DONG = "23000001";
    private static final String GYEONGGI_DONG = "31000001";

    private final InMemoryGtfsNetworkRepository networkRepository = new InMemoryGtfsNetworkRepository();
    private final CommuteAreaService service = new CommuteAreaService(
            new TransitNetworkCache(new TransitNetworkLoader(networkRepository), Clock.systemUTC()));

    @Test
    @DisplayName("갈 수 있는 정류장을 행정동으로 묶고 통근 시간이 짧은 동네부터 돌려준다")
    void groupsStopsByAdminDong() {
        networkRepository.replace(feed());

        CommuteAreaSearchResult result = service.search(DESTINATION, 60, 2);

        assertThat(result.maxMinutes()).isEqualTo(60);
        assertThat(result.areas()).extracting(CommuteArea::adminDongCode).containsExactly(NEAR_DONG, FAR_DONG);
        CommuteArea far = result.areas().get(1);
        assertThat(far.stations()).extracting(station -> station.stop().stopId()).containsExactly("B", "C");
        assertThat(far.commuteMinutes()).isEqualTo(far.stations().getFirst().travelMinutes());
    }

    @Test
    @DisplayName("행정동을 찾지 못한 정류장은 결과에서 뺀다")
    void excludesStopsWithoutAdminDong() {
        networkRepository.replace(feed());

        CommuteAreaSearchResult result = service.search(DESTINATION, 60, 2);

        assertThat(result.areas()).flatExtracting(CommuteArea::stations)
                .extracting(station -> station.stop().stopId())
                .doesNotContain("D");
    }

    @Test
    @DisplayName("인천 정류장은 노선망에서 지나갈 수 있지만 결과 동네에서는 뺀다")
    void excludesIncheonAreas() {
        networkRepository.replace(new GtfsFeed(
                List.of(new GtfsRoute("R1", "1", "1번", 3, new Seconds(120))),
                List.of(stop("A", 37.5000, 127.0010, NEAR_DONG), stop("I", 37.5100, 127.0010, INCHEON_DONG),
                        stop("G", 37.5200, 127.0010, GYEONGGI_DONG)),
                List.of(edge("G", "I"), edge("I", "A")),
                List.of()));

        CommuteAreaSearchResult result = service.search(DESTINATION, 60, 2);

        assertThat(codes(result)).containsExactly(NEAR_DONG, GYEONGGI_DONG);
    }

    @Test
    @DisplayName("최대 통근 시간을 늘리면 이전 결과의 동네를 모두 포함한다")
    void widensWithMaxMinutes() {
        networkRepository.replace(feed());

        List<String> narrow = codes(service.search(DESTINATION, 5, 2));
        List<String> wide = codes(service.search(DESTINATION, 60, 2));

        assertThat(narrow).containsExactly(NEAR_DONG);
        assertThat(wide).containsAll(narrow).hasSizeGreaterThan(narrow.size());
    }

    @Test
    @DisplayName("목적지에서 걸어서 10분 안에 정류장이 없으면 탐색하지 않는다")
    void failsWhenNoArrivalStop() {
        networkRepository.replace(feed());

        assertThatThrownBy(() -> service.search(new Coordinate(35.1, 129.0), 60, 2))
                .isInstanceOf(BusinessRuleViolationException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.COMMUTE_DESTINATION_UNREACHABLE);
    }

    @Test
    @DisplayName("노선망이 적재되지 않았으면 잠시 후 다시 시도하도록 알린다")
    void failsWhenNetworkIsEmpty() {
        assertThatThrownBy(() -> service.search(DESTINATION, 60, 2))
                .isInstanceOf(ServiceUnavailableException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.TRANSIT_NETWORK_UNAVAILABLE);
    }

    private static List<String> codes(final CommuteAreaSearchResult result) {
        return result.areas().stream().map(CommuteArea::adminDongCode).toList();
    }

    private static GtfsFeed feed() {
        return new GtfsFeed(
                List.of(new GtfsRoute("R1", "1", "1번", 3, new Seconds(120))),
                List.of(stop("A", 37.5000, 127.0010, NEAR_DONG), stop("B", 37.5100, 127.0010, FAR_DONG),
                        stop("C", 37.5200, 127.0010, FAR_DONG), stop("D", 37.5300, 127.0010, null)),
                List.of(edge("D", "C"), edge("C", "B"), edge("B", "A")),
                List.of());
    }

    private static GtfsStop stop(final String stopId, final double latitude, final double longitude,
                                 final String adminDongCode) {
        return new GtfsStop(stopId, stopId + " 정류장", new Coordinate(latitude, longitude), adminDongCode);
    }

    private static GtfsEdge edge(final String from, final String to) {
        return new GtfsEdge("R1", from, to, new Seconds(180));
    }
}
