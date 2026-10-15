package com.jachwisunbae.map.domain.cctv;

import java.util.Arrays;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

// 전국CCTV표준데이터의 설치목적구분. DB에는 원본 문자열(sourceName)을 저장하고, API 응답은 enum 이름을 코드로 쓴다.
public enum CctvPurpose {

    CRIME_PREVENTION("생활방범"),
    MULTI_PURPOSE("다목적"),
    CHILD_PROTECTION("어린이보호"),
    TRAFFIC_ENFORCEMENT("교통단속"),
    FACILITY_MANAGEMENT("시설물관리"),
    DISASTER("재난재해"),
    VEHICLE_CRIME_PREVENTION("차량방범"),
    ILLEGAL_DUMPING("쓰레기단속"),
    ETC("기타"),
    TRAFFIC_INFORMATION("교통정보수집");

    private static final Map<String, CctvPurpose> BY_SOURCE_NAME = Arrays.stream(values())
            .collect(Collectors.toUnmodifiableMap(purpose -> purpose.sourceName, Function.identity()));

    private final String sourceName;

    CctvPurpose(String sourceName) {
        this.sourceName = sourceName;
    }

    // 적재 스크립트가 10가지 원본 값만 넣으므로, 목록에 없는 값은 서버 데이터 문제다.
    public static CctvPurpose fromSourceName(String sourceName) {
        CctvPurpose purpose = sourceName == null ? null : BY_SOURCE_NAME.get(sourceName);
        if (purpose == null) {
            throw new IllegalArgumentException("알 수 없는 CCTV 설치목적입니다: " + sourceName);
        }
        return purpose;
    }

    public String getSourceName() {
        return sourceName;
    }
}
