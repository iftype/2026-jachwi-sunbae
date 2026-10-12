package com.jachwisunbae.transit.domain.collection;

import static org.assertj.core.api.Assertions.assertThat;

import com.jachwisunbae.transit.domain.vo.Seconds;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class TravelTimeSamplesTest {

    @Test
    @DisplayName("홀수 개 이동 시간은 가운데 값을 대표 이동 시간으로 쓴다")
    void usesMiddleValueForOddSamples() {
        TravelTimeSamples samples = new TravelTimeSamples();
        samples.add(new Seconds(300));
        samples.add(new Seconds(60));
        samples.add(new Seconds(120));

        assertThat(samples.median()).isEqualTo(new Seconds(120));
    }

    @Test
    @DisplayName("짝수 개 이동 시간은 가운데 두 값의 평균을 반올림한다")
    void roundsAverageOfMiddleValuesForEvenSamples() {
        TravelTimeSamples samples = new TravelTimeSamples();
        for (int seconds : new int[]{30, 61, 90, 200, 10}) {
            samples.add(new Seconds(seconds));
        }
        samples.add(new Seconds(70));

        assertThat(samples.median()).isEqualTo(new Seconds(66));
    }
}
