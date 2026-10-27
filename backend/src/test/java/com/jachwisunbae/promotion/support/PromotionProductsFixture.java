package com.jachwisunbae.promotion.support;

import com.jachwisunbae.promotion.domain.ConvenienceBrand;
import com.jachwisunbae.promotion.domain.ProductCategory;
import com.jachwisunbae.promotion.domain.PromotionProduct;
import com.jachwisunbae.promotion.domain.PromotionType;

public final class PromotionProductsFixture {

    private PromotionProductsFixture() {
    }

    public static PromotionProduct product(final String name) {
        return new PromotionProduct(ConvenienceBrand.EMART24, name, 3000, "https://example.com/product.jpg",
                ProductCategory.MEAL, PromotionType.ONE_PLUS_ONE);
    }
}
