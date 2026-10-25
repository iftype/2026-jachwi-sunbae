package com.jachwisunbae.transit.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.common.exception.server.ServiceUnavailableException;
import com.jachwisunbae.transit.domain.GtfsFeed;
import com.jachwisunbae.transit.domain.GtfsRoute;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.network.TransitNetwork;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import com.jachwisunbae.transit.domain.vo.Seconds;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class TransitNetworkCacheTest {

    private final InMemoryGtfsNetworkRepository repository = new InMemoryGtfsNetworkRepository();
    private final MutableClock clock = new MutableClock(Instant.parse("2026-10-14T00:00:00Z"));
    private final TransitNetworkCache cache = new TransitNetworkCache(new TransitNetworkLoader(repository), clock);

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
    @DisplayName("노선망을 읽지 못하면 다시 읽을 시간이 될 때까지 DB를 읽지 않고 바로 실패한다")
    void rejectsWithoutLoadingBeforeRetry() {
        assertThatThrownBy(cache::get).isInstanceOf(ServiceUnavailableException.class);
        repository.replace(feed());

        clock.advance(TransitNetworkCache.RETRY_DELAY.minusSeconds(1));

        assertThatThrownBy(cache::get).isInstanceOf(ServiceUnavailableException.class);
        assertThat(repository.findStopsCount).isEqualTo(1);
    }

    @Test
    @DisplayName("노선망을 읽지 못해도 담아 두지 않고, 다시 읽을 시간이 지나면 적재된 노선망을 읽는다")
    void loadsAfterRetryDelay() {
        assertThatThrownBy(cache::get).isInstanceOf(ServiceUnavailableException.class);
        repository.replace(feed());

        clock.advance(TransitNetworkCache.RETRY_DELAY);

        assertThat(cache.get().hasArrivalStop(new Coordinate(37.55, 126.97))).isTrue();
        assertThat(repository.findStopsCount).isEqualTo(2);
    }

    private static GtfsFeed feed() {
        return new GtfsFeed(List.of(new GtfsRoute("R1", "1", "1번", 3, new Seconds(120))),
                List.of(new GtfsStop("S1", "서울역", new Coordinate(37.55, 126.97))), List.of(), List.of());
    }

    private static class MutableClock extends Clock {

        private Instant instant;

        MutableClock(Instant instant) {
            this.instant = instant;
        }

        void advance(Duration duration) {
            instant = instant.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return instant;
        }
    }
}
