package com.jachwisunbae.transit.domain.vo;

// 이동·환승·대기 시간을 초 단위로 표현한다.
public record Seconds(int value) {

    public Seconds {
        if (value < 0) {
            throw new IllegalArgumentException("시간은 0초 이상이어야 합니다. value=" + value);
        }
    }
}
