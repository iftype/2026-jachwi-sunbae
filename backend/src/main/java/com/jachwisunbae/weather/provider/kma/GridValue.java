package com.jachwisunbae.weather.provider.kma;

import com.jachwisunbae.weather.domain.GridPoint;

// 결측값을 제외한 격자 한 곳의 원본 숫자다. 기온·확률 등의 의미는 요소에 따라 해석한다.
public record GridValue(GridPoint point, double value) {

    public GridValue {
        if (point == null || !Double.isFinite(value) || value == -99.0 || value == -999.0) {
            throw new IllegalArgumentException("격자 좌표와 유효한 기상 값이 필요합니다.");
        }
    }
}
