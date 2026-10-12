package com.jachwisunbae.map.domain.cctv;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class CctvPurposeTest {

    @ParameterizedTest
    @CsvSource({
            "생활방범, CRIME_PREVENTION",
            "다목적, MULTI_PURPOSE",
            "어린이보호, CHILD_PROTECTION",
            "교통단속, TRAFFIC_ENFORCEMENT",
            "시설물관리, FACILITY_MANAGEMENT",
            "재난재해, DISASTER",
            "차량방범, VEHICLE_CRIME_PREVENTION",
            "쓰레기단속, ILLEGAL_DUMPING",
            "기타, ETC",
            "교통정보수집, TRAFFIC_INFORMATION"
    })
    @DisplayName("공공데이터 설치목적 원본 값을 설치목적으로 바꾼다")
    void convertsSourceName(String sourceName, CctvPurpose expected) {
        assertThat(CctvPurpose.fromSourceName(sourceName)).isEqualTo(expected);
        assertThat(expected.getSourceName()).isEqualTo(sourceName);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"방범", "CRIME_PREVENTION", " 생활방범"})
    @DisplayName("목록에 없는 원본 값은 설치목적으로 바꿀 수 없다")
    void rejectsUnknownSourceName(String sourceName) {
        assertThatThrownBy(() -> CctvPurpose.fromSourceName(sourceName))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
