package com.jachwisunbae.transit.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;

import com.jachwisunbae.transit.domain.AdminDong;
import com.jachwisunbae.transit.domain.GtfsEdge;
import com.jachwisunbae.transit.domain.GtfsFeed;
import com.jachwisunbae.transit.domain.GtfsRoute;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.GtfsTransfer;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import com.jachwisunbae.transit.domain.vo.Seconds;
import com.jachwisunbae.transit.provider.gtfs.GtfsFeedReader;
import com.jachwisunbae.transit.service.dto.result.GtfsImportResult;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class GtfsImportServiceTest {

    private static final AdminDong INCHEON_DONG = AdminDongFixture.adminDong("23010520", "인천동",
            126.60, 126.70, 37.40, 37.50);
    private static final AdminDong BUSAN_DONG = AdminDongFixture.adminDong("21010510", "부산동",
            129.00, 129.10, 35.10, 35.20);
    private static final List<AdminDong> ADMIN_DONGS = List.of(AdminDongFixture.SEOUL_STATION_DONG, INCHEON_DONG,
            BUSAN_DONG);

    // 경계 밖(N1) - 서울(S1) - 인천(I1) - 부산(B1) - 경계 밖(X1) 순서로 이어진 노선망이다.
    // N1은 서울 정류장과 이어져 있고, X1은 부산 정류장과만 이어져 있다.
    private static final GtfsFeed FEED = new GtfsFeed(
            List.of(route("R1"), route("R2"), route("R3")),
            List.of(new GtfsStop("S1", "서울역", new Coordinate(37.55, 126.97)),
                    new GtfsStop("I1", "인천역", new Coordinate(37.45, 126.65)),
                    new GtfsStop("N1", "경계 틈", new Coordinate(37.60, 127.00)),
                    new GtfsStop("B1", "부산역", new Coordinate(35.15, 129.05)),
                    new GtfsStop("X1", "섬", new Coordinate(34.00, 126.00))),
            List.of(edge("R1", "N1", "S1"), edge("R1", "S1", "I1"), edge("R2", "I1", "B1"), edge("R3", "B1", "X1")),
            List.of(transfer("S1", "I1"), transfer("I1", "B1")));

    @TempDir
    Path directory;

    private final InMemoryGtfsNetworkRepository networkRepository = new InMemoryGtfsNetworkRepository();
    private final GtfsFeedReader reader = new GtfsFeedReader() {
        @Override
        public GtfsFeed read(final Path feedDirectory) {
            return FEED;
        }
    };

    @Test
    @DisplayName("수도권 정류장과 이어진 행정동 없는 정류장, 그 사이 구간·환승·노선만 저장하고 적재 건수를 돌려준다")
    void keepsOnlyCapitalRegion() {
        GtfsImportService service = new GtfsImportService(directory.toString(), reader, networkRepository,
                new InMemoryAdminDongRepository(ADMIN_DONGS));

        GtfsImportResult result = service.importFeed();

        assertThat(networkRepository.stops()).extracting(GtfsStop::stopId, GtfsStop::adminDongCode)
                .containsExactly(tuple("S1", "11010530"), tuple("I1", "23010520"), tuple("N1", null));
        GtfsFeed saved = networkRepository.replacedFeeds.getFirst();
        assertThat(saved.edges()).containsExactly(edge("R1", "N1", "S1"), edge("R1", "S1", "I1"));
        assertThat(saved.routes()).extracting(GtfsRoute::routeId).containsExactly("R1");
        assertThat(saved.transfers()).containsExactly(transfer("S1", "I1"));
        assertThat(result).isEqualTo(new GtfsImportResult(1, 3, 2, 1, 2));
    }

    @Test
    @DisplayName("행정동 경계가 적재되지 않았으면 정류장의 지역을 알 수 없어 적재하지 않는다")
    void rejectsWithoutAdminDongs() {
        GtfsImportService service = new GtfsImportService(directory.toString(), reader, networkRepository,
                new InMemoryAdminDongRepository(List.of()));

        assertThatThrownBy(service::importFeed).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("행정동");
        assertThat(networkRepository.replacedFeeds).isEmpty();
    }

    @Test
    @DisplayName("GTFS 디렉터리가 비어 있거나 존재하지 않으면 적재하지 않는다")
    void rejectsMissingDirectory() {
        InMemoryAdminDongRepository adminDongRepository = new InMemoryAdminDongRepository(ADMIN_DONGS);

        assertThatThrownBy(() -> new GtfsImportService("", reader, networkRepository, adminDongRepository)
                .importFeed())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("디렉터리");
        assertThatThrownBy(() -> new GtfsImportService(directory.resolve("none").toString(), reader,
                networkRepository, adminDongRepository).importFeed())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("디렉터리");
        assertThat(networkRepository.replacedFeeds).isEmpty();
    }

    private static GtfsRoute route(final String routeId) {
        return new GtfsRoute(routeId, routeId, routeId + " 노선", 3, new Seconds(300));
    }

    private static GtfsEdge edge(final String routeId, final String from, final String to) {
        return new GtfsEdge(routeId, from, to, new Seconds(120));
    }

    private static GtfsTransfer transfer(final String from, final String to) {
        return new GtfsTransfer(from, to, new Seconds(60));
    }
}
