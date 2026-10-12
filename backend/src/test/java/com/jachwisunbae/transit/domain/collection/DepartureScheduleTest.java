package com.jachwisunbae.transit.domain.collection;

import static org.assertj.core.api.Assertions.assertThat;

import com.jachwisunbae.transit.domain.vo.Seconds;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class DepartureScheduleTest {

    @Test
    @DisplayName("운행 간격 중앙값의 절반을 탑승 대기 시간으로 쓴다")
    void usesHalfOfMedianHeadway() {
        DepartureSchedule schedule = new DepartureSchedule(List.of(28_800, 30_000, 31_200));

        assertThat(schedule.waitTime()).isEqualTo(new Seconds(600));
    }

    @Test
    @DisplayName("같은 시각에 출발하는 운행편은 0초 간격이 되어 1분 미만 규칙으로 제외된다")
    void ignoresDeparturesAtSameTime() {
        DepartureSchedule schedule = new DepartureSchedule(List.of(28_800, 30_000, 30_000, 31_200, 31_200));

        assertThat(schedule.waitTime()).isEqualTo(new Seconds(600));
    }

    @Test
    @DisplayName("대기 시간은 2분 이상 15분 이하로 제한한다")
    void clampsWaitSeconds() {
        assertThat(new DepartureSchedule(List.of(0, 120, 240)).waitTime()).isEqualTo(new Seconds(120));
        assertThat(new DepartureSchedule(List.of(0, 7_200)).waitTime()).isEqualTo(new Seconds(900));
    }

    @Test
    @DisplayName("쓸 수 있는 운행 간격이 없으면 10분 간격으로 보고 5분을 기다린다")
    void usesDefaultHeadwayWithoutUsableGaps() {
        assertThat(new DepartureSchedule(List.of(28_800)).waitTime()).isEqualTo(new Seconds(300));
        assertThat(new DepartureSchedule(List.of(0, 30, 10_000)).waitTime()).isEqualTo(new Seconds(300));
    }

    @Test
    @DisplayName("운행 간격이 짝수 개면 이동 시간과 같은 중앙값 정의로 가운데 두 간격의 평균을 쓴다")
    void usesSameMedianDefinitionAsTravelTime() {
        DepartureSchedule schedule = new DepartureSchedule(List.of(0, 600, 1_800));

        assertThat(schedule.waitTime()).isEqualTo(new Seconds(450));
    }
}
