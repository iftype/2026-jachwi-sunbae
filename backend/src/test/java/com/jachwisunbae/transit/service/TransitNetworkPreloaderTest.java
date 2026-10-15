package com.jachwisunbae.transit.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import com.jachwisunbae.transit.domain.GtfsFeed;
import com.jachwisunbae.transit.domain.GtfsRoute;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import com.jachwisunbae.transit.domain.vo.Seconds;
import java.time.Clock;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class TransitNetworkPreloaderTest {

    private final InMemoryGtfsNetworkRepository repository = new InMemoryGtfsNetworkRepository();
    private final TransitNetworkCache cache = new TransitNetworkCache(new TransitNetworkLoader(repository),
            Clock.systemUTC());
    private final TransitNetworkPreloader preloader = new TransitNetworkPreloader(cache);

    @Test
    @DisplayName("서버가 뜰 때 노선망을 미리 읽어 첫 탐색에서 다시 읽지 않는다")
    void preloadsNetwork() {
        repository.replace(new GtfsFeed(List.of(new GtfsRoute("R1", "1", "1번", 3, new Seconds(120))),
                List.of(new GtfsStop("S1", "서울역", new Coordinate(37.55, 126.97))), List.of(), List.of()));

        preloader.preload();
        cache.get();

        assertThat(repository.findStopsCount).isEqualTo(1);
    }

    @Test
    @DisplayName("노선망이 비어 있어도 서버 시작을 막지 않는다")
    void ignoresEmptyNetwork() {
        assertThatCode(preloader::preload).doesNotThrowAnyException();
    }
}
