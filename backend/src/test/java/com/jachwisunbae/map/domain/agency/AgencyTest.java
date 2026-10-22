package com.jachwisunbae.map.domain.agency;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AgencyTest {

    private static final BigDecimal LATITUDE = new BigDecimal("37.4064");
    private static final BigDecimal LONGITUDE = new BigDecimal("127.0888");

    @Test
    @DisplayName("주소가 없으면 빈 문자열로, 비어 있는 전화번호와 상세 페이지 URL은 null로 정규화한다")
    void normalizesOptionalFields() {
        Agency agency = new Agency("kakao:1", "판교 공인중개사", null, LATITUDE, LONGITUDE, 100, " ", "");

        assertThat(agency.address()).isEmpty();
        assertThat(agency.phone()).isNull();
        assertThat(agency.placeUrl()).isNull();
    }

    @Test
    @DisplayName("전화번호와 상세 페이지 URL이 있으면 그대로 유지한다")
    void keepsPhoneAndPlaceUrl() {
        Agency agency = new Agency("kakao:1", "판교 공인중개사", "주소", LATITUDE, LONGITUDE, 100,
                "031-123-4567", "http://place.map.kakao.com/1");

        assertThat(agency.phone()).isEqualTo("031-123-4567");
        assertThat(agency.placeUrl()).isEqualTo("http://place.map.kakao.com/1");
    }

    @Test
    @DisplayName("ID나 이름이 비어 있으면 만들 수 없다")
    void requiresIdAndName() {
        assertThatThrownBy(() -> new Agency(" ", "판교 공인중개사", "주소", LATITUDE, LONGITUDE, 100, null, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Agency("kakao:1", "", "주소", LATITUDE, LONGITUDE, 100, null, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("좌표가 없거나 범위를 벗어나면 만들 수 없다")
    void requiresValidCoordinates() {
        assertThatThrownBy(() -> new Agency("kakao:1", "판교 공인중개사", "주소", null, LONGITUDE, 100, null, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Agency("kakao:1", "판교 공인중개사", "주소", new BigDecimal("91"), LONGITUDE,
                100, null, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Agency("kakao:1", "판교 공인중개사", "주소", LATITUDE, new BigDecimal("-181"),
                100, null, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("거리가 음수이면 만들 수 없다")
    void requiresNonNegativeDistance() {
        assertThatThrownBy(() -> new Agency("kakao:1", "판교 공인중개사", "주소", LATITUDE, LONGITUDE, -1, null, null))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
