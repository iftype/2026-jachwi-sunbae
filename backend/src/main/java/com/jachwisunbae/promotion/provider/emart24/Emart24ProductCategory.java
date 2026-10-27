package com.jachwisunbae.promotion.provider.emart24;

import com.jachwisunbae.promotion.domain.ProductCategory;

// 공식 화면의 base_category_seq. 전체는 상품 분류가 아닌 조회 필터이므로 포함하지 않는다.
enum Emart24ProductCategory {
    MEAL(1, ProductCategory.MEAL),
    SNACK(2, ProductCategory.SNACK),
    BEVERAGE(5, ProductCategory.BEVERAGE),
    HOUSEHOLD_GOODS(3, ProductCategory.HOUSEHOLD_GOODS);

    private final int code;
    private final ProductCategory category;

    Emart24ProductCategory(final int code, final ProductCategory category) {
        this.code = code;
        this.category = category;
    }

    int code() {
        return code;
    }

    ProductCategory category() {
        return category;
    }
}
