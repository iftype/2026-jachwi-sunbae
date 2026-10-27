package com.jachwisunbae.promotion.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class PromotionProductTest {

    private static final String IMAGE_URL = "https://emart24.co.kr/image.jpg";

    @Test
    @DisplayName("행사상품을 생성한다")
    void createsPromotionProduct() {
        PromotionProduct product = new PromotionProduct(ConvenienceBrand.EMART24, "상품", 0, IMAGE_URL,
                ProductCategory.MEAL, PromotionType.ONE_PLUS_ONE);

        assertThat(product.name()).isEqualTo("상품");
        assertThat(product.price()).isZero();
    }

    @Test
    @DisplayName("모든 값이 같은 행사상품은 동등하다")
    void equalsByValue() {
        PromotionProduct product = new PromotionProduct(ConvenienceBrand.EMART24, "상품", 1000, IMAGE_URL,
                ProductCategory.MEAL, PromotionType.ONE_PLUS_ONE);
        PromotionProduct same = new PromotionProduct(ConvenienceBrand.EMART24, "상품", 1000, IMAGE_URL,
                ProductCategory.MEAL, PromotionType.ONE_PLUS_ONE);
        PromotionProduct otherPromotion = new PromotionProduct(ConvenienceBrand.EMART24, "상품", 1000, IMAGE_URL,
                ProductCategory.MEAL, PromotionType.TWO_PLUS_ONE);

        assertThat(product).isEqualTo(same).hasSameHashCodeAs(same).isNotEqualTo(otherPromotion);
    }

    @Test
    @DisplayName("브랜드, 카테고리, 행사 유형이 없으면 만들 수 없다")
    void requiresEnumFields() {
        assertThatThrownBy(() -> new PromotionProduct(null, "상품", 1000, IMAGE_URL,
                ProductCategory.MEAL, PromotionType.ONE_PLUS_ONE)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new PromotionProduct(ConvenienceBrand.EMART24, "상품", 1000, IMAGE_URL,
                null, PromotionType.ONE_PLUS_ONE)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new PromotionProduct(ConvenienceBrand.EMART24, "상품", 1000, IMAGE_URL,
                ProductCategory.MEAL, null)).isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = " ")
    @DisplayName("이름이 비어 있으면 만들 수 없다")
    void requiresName(final String name) {
        assertThatThrownBy(() -> new PromotionProduct(ConvenienceBrand.EMART24, name, 1000, IMAGE_URL,
                ProductCategory.MEAL, PromotionType.ONE_PLUS_ONE)).isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @ValueSource(ints = {-1, Integer.MIN_VALUE})
    @DisplayName("가격이 음수이면 만들 수 없다")
    void rejectsNegativePrice(final int price) {
        assertThatThrownBy(() -> new PromotionProduct(ConvenienceBrand.EMART24, "상품", price, IMAGE_URL,
                ProductCategory.MEAL, PromotionType.ONE_PLUS_ONE)).isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "/image.jpg", "ftp://emart24.co.kr/image.jpg", "data:image/png;base64,test",
            "https://[invalid"})
    @DisplayName("이미지 주소가 절대 HTTP URL이 아니면 만들 수 없다")
    void requiresAbsoluteHttpImageUrl(final String imageUrl) {
        assertThatThrownBy(() -> new PromotionProduct(ConvenienceBrand.EMART24, "상품", 1000, imageUrl,
                ProductCategory.MEAL, PromotionType.ONE_PLUS_ONE)).isInstanceOf(IllegalArgumentException.class);
    }
}
