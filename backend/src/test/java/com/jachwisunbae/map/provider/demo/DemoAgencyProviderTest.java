package com.jachwisunbae.map.provider.demo;

import static org.assertj.core.api.Assertions.assertThat;

import com.jachwisunbae.map.domain.agency.Agency;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class DemoAgencyProviderTest {

    private static final BigDecimal LATITUDE = new BigDecimal("37.5665");
    private static final BigDecimal LONGITUDE = new BigDecimal("126.9780");

    private final DemoAgencyProvider provider = new DemoAgencyProvider();

    @Test
    @DisplayName("데모 중개업소 2건을 전화번호, 상세 페이지 URL과 함께 가까운 순으로 반환한다")
    void returnsDemoAgenciesWithContactsByDistance() {
        List<Agency> agencies = provider.nearby(LATITUDE, LONGITUDE, 1000);

        assertThat(agencies).extracting(Agency::providerPlaceId).containsExactly("demo-agency-2", "demo-agency-1");
        assertThat(agencies).allSatisfy(agency -> {
            assertThat(agency.phone()).isNotNull();
            assertThat(agency.placeUrl()).isNotNull();
        });
    }

    @Test
    @DisplayName("반경 밖의 데모 중개업소는 제외한다")
    void excludesAgenciesOutsideRadius() {
        List<Agency> agencies = provider.nearby(LATITUDE, LONGITUDE, 500);

        assertThat(agencies).extracting(Agency::providerPlaceId).containsExactly("demo-agency-2");
    }
}
