package com.jachwisunbae.transit.domain;

import java.util.Set;

// 생활권 탐색의 서비스 지역을 통계청 행정동 코드의 앞 두 자리(시도)로 정한다.
// 노선망에는 수도권(서울 11, 인천 23, 경기 31) 정류장만 담는다. 서울·경기를 오가는 경로가 인천을 지나도 끊기지 않게 인천도 남긴다.
// 탐색 결과에는 서울·경기 동네만 보여 준다.
public final class CapitalRegion {

    private static final Set<String> NETWORK_SIDO_CODES = Set.of("11", "23", "31");
    private static final Set<String> RESULT_SIDO_CODES = Set.of("11", "31");

    private CapitalRegion() {
    }

    public static boolean includesInNetwork(final String adminDongCode) {
        return hasSido(adminDongCode, NETWORK_SIDO_CODES);
    }

    public static boolean includesInResult(final String adminDongCode) {
        return hasSido(adminDongCode, RESULT_SIDO_CODES);
    }

    private static boolean hasSido(final String adminDongCode, final Set<String> sidoCodes) {
        return adminDongCode != null && adminDongCode.length() >= 2
                && sidoCodes.contains(adminDongCode.substring(0, 2));
    }
}
