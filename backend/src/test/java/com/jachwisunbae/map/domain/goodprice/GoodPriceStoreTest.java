package com.jachwisunbae.map.domain.goodprice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class GoodPriceStoreTest {

    private static final BigDecimal LATITUDE = new BigDecimal("37.3942055");
    private static final BigDecimal LONGITUDE = new BigDecimal("127.1091021");
    private static final LocalDate SOURCE_DATE = LocalDate.of(2026, 6, 30);
    private static final List<GoodPriceMenu> MENUS = List.of(new GoodPriceMenu("김치찌개", "7000"));

    @Test
    @DisplayName("착한가격업소를 복원한다")
    void reconstructs() {
        GoodPriceStore store = GoodPriceStore.reconstruct(1L, "경기도", "성남시", "한식", "좋은식당", "031-123-4567",
                "경기도 성남시 분당구 판교역로 1", LATITUDE, LONGITUDE, MENUS, SOURCE_DATE);

        assertThat(store.getId()).isEqualTo(1L);
        assertThat(store.getBusinessType()).isEqualTo("한식");
        assertThat(store.getMenus()).containsExactly(new GoodPriceMenu("김치찌개", "7000"));
        assertThat(store.getSourceDate()).isEqualTo(SOURCE_DATE);
    }

    @Test
    @DisplayName("시군, 연락처, 메뉴가 없어도 복원한다")
    void allowsMissingOptionalValues() {
        GoodPriceStore store = GoodPriceStore.reconstruct(1L, "세종특별자치시", null, "한식", "좋은식당", null,
                "세종특별자치시 한누리대로 1", LATITUDE, LONGITUDE, List.of(), SOURCE_DATE);

        assertThat(store.getDistrict()).isNull();
        assertThat(store.getPhone()).isNull();
        assertThat(store.getMenus()).isEmpty();
    }

    @Test
    @DisplayName("업종과 가격은 원본 문자열을 그대로 유지한다")
    void keepsOriginalText() {
        List<GoodPriceMenu> menus = List.of(new GoodPriceMenu("커트", "일반: 10000원/ 노인: 8000원"),
                new GoodPriceMenu("파마", "25000~45000"));

        GoodPriceStore store = GoodPriceStore.reconstruct(1L, "경기도", "성남시", "이용업", "좋은이발소", null,
                "경기도 성남시 분당구 판교역로 1", LATITUDE, LONGITUDE, menus, SOURCE_DATE);

        assertThat(store.getBusinessType()).isEqualTo("이용업");
        assertThat(store.getMenus()).extracting(GoodPriceMenu::price)
                .containsExactly("일반: 10000원/ 노인: 8000원", "25000~45000");
    }

    @Test
    @DisplayName("복원 후 원본 메뉴 목록이 바뀌어도 영향을 받지 않는다")
    void copiesMenus() {
        List<GoodPriceMenu> menus = new ArrayList<>(MENUS);
        GoodPriceStore store = GoodPriceStore.reconstruct(1L, "경기도", "성남시", "한식", "좋은식당", null,
                "경기도 성남시 분당구 판교역로 1", LATITUDE, LONGITUDE, menus, SOURCE_DATE);

        menus.clear();

        assertThat(store.getMenus()).hasSize(1);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = " ")
    @DisplayName("시도, 업종, 이름, 주소가 없으면 복원할 수 없다")
    void requiresText(String value) {
        assertThatThrownBy(() -> GoodPriceStore.reconstruct(1L, value, null, "한식", "좋은식당", null, "주소",
                LATITUDE, LONGITUDE, MENUS, SOURCE_DATE)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> GoodPriceStore.reconstruct(1L, "경기도", null, value, "좋은식당", null, "주소",
                LATITUDE, LONGITUDE, MENUS, SOURCE_DATE)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> GoodPriceStore.reconstruct(1L, "경기도", null, "한식", value, null, "주소",
                LATITUDE, LONGITUDE, MENUS, SOURCE_DATE)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> GoodPriceStore.reconstruct(1L, "경기도", null, "한식", "좋은식당", null, value,
                LATITUDE, LONGITUDE, MENUS, SOURCE_DATE)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("ID, 메뉴 목록, 기준일이 없으면 복원할 수 없다")
    void requiresIdMenusAndSourceDate() {
        assertThatThrownBy(() -> GoodPriceStore.reconstruct(null, "경기도", null, "한식", "좋은식당", null, "주소",
                LATITUDE, LONGITUDE, MENUS, SOURCE_DATE)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> GoodPriceStore.reconstruct(1L, "경기도", null, "한식", "좋은식당", null, "주소",
                LATITUDE, LONGITUDE, null, SOURCE_DATE)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> GoodPriceStore.reconstruct(1L, "경기도", null, "한식", "좋은식당", null, "주소",
                LATITUDE, LONGITUDE, MENUS, null)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("좌표가 없거나 범위를 벗어나면 복원할 수 없다")
    void requiresValidCoordinate() {
        assertThatThrownBy(() -> GoodPriceStore.reconstruct(1L, "경기도", null, "한식", "좋은식당", null, "주소",
                null, LONGITUDE, MENUS, SOURCE_DATE)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> GoodPriceStore.reconstruct(1L, "경기도", null, "한식", "좋은식당", null, "주소",
                new BigDecimal("90.0000001"), LONGITUDE, MENUS, SOURCE_DATE))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> GoodPriceStore.reconstruct(1L, "경기도", null, "한식", "좋은식당", null, "주소",
                LATITUDE, new BigDecimal("-180.0000001"), MENUS, SOURCE_DATE))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("기준 좌표에서 업소까지의 거리를 계산한다")
    void calculatesDistance() {
        GoodPriceStore store = GoodPriceStore.reconstruct(1L, "경기도", null, "한식", "좋은식당", null, "주소",
                LATITUDE, LONGITUDE, MENUS, SOURCE_DATE);

        assertThat(store.distanceMetersFrom(LATITUDE, LONGITUDE)).isZero();
    }
}
