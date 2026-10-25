package com.jachwisunbae.transit.domain.network.search;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class SearchStatesTest {

    @Test
    @DisplayName("상태 키에서 정류장, 노선, 탑승 횟수를 그대로 되돌린다")
    void decodesKey() {
        SearchStates states = new SearchStates();

        int walking = states.findOrInsert(SearchStates.key(214_236, -1, 0));
        int riding = states.findOrInsert(SearchStates.key(7, 25_812, 3));

        assertThat(states.stop(walking)).isEqualTo(214_236);
        assertThat(states.route(walking)).isEqualTo(-1);
        assertThat(states.boardings(walking)).isZero();
        assertThat(states.stop(riding)).isEqualTo(7);
        assertThat(states.route(riding)).isEqualTo(25_812);
        assertThat(states.boardings(riding)).isEqualTo(3);
    }

    @Test
    @DisplayName("같은 상태는 한 번만 만들고, 늘어나도 기존 상태와 기록을 잃지 않는다")
    void keepsStatesWhileGrowing() {
        SearchStates states = new SearchStates();
        for (int stop = 0; stop < 100_000; stop++) {
            int state = states.findOrInsert(SearchStates.key(stop, stop % 50, stop % 3));
            states.update(state, stop, state - 1, stop * 2, stop % 7);
        }

        int state = states.find(SearchStates.key(77_777, 77_777 % 50, 77_777 % 3));
        assertThat(states.findOrInsert(SearchStates.key(77_777, 77_777 % 50, 77_777 % 3))).isEqualTo(state);
        assertThat(states.seconds(state)).isEqualTo(77_777);
        assertThat(states.link(state)).isEqualTo(155_554);
        assertThat(states.waitSeconds(state)).isEqualTo(77_777 % 7);
        assertThat(states.find(SearchStates.key(77_777, 1, 1))).isEqualTo(SearchStates.NONE);
    }
}
