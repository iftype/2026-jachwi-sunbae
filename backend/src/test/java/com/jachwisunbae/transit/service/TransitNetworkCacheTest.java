package com.jachwisunbae.transit.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.common.exception.server.ServiceUnavailableException;
import com.jachwisunbae.transit.domain.GtfsFeed;
import com.jachwisunbae.transit.domain.GtfsRoute;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.collection.TransitNetwork;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import com.jachwisunbae.transit.domain.vo.Seconds;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class TransitNetworkCacheTest {

    private final InMemoryGtfsNetworkRepository repository = new InMemoryGtfsNetworkRepository();
    private final TransitNetworkCache cache = new TransitNetworkCache(new TransitNetworkLoader(repository));

    @Test
    @DisplayName("노선망은 처음 한 번만 DB에서 읽고 이후에는 메모리의 노선망을 쓴다")
    void loadsOnce() {
        repository.replace(feed());

        TransitNetwork first = cache.get();
        TransitNetwork second = cache.get();

        assertThat(second).isSameAs(first);
        assertThat(repository.findStopsCount).isEqualTo(1);
    }

    @Test
    @DisplayName("노선망이 비어 있으면 담아 두지 않고, 적재된 뒤 다음 요청에서 읽는다")
    void retriesAfterEmptyNetwork() {
        assertThatThrownBy(cache::get).isInstanceOf(ServiceUnavailableException.class);

        repository.replace(feed());

        assertThat(cache.get().hasArrivalStop(new Coordinate(37.55, 126.97))).isTrue();
    }

    private static GtfsFeed feed() {
        return new GtfsFeed(List.of(new GtfsRoute("R1", "1", "1번", 3, new Seconds(120))),
                List.of(new GtfsStop("S1", "서울역", new Coordinate(37.55, 126.97))), List.of(), List.of());
    }
}
