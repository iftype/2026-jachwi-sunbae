package com.jachwisunbae.promotion.domain;

import java.net.URI;

// 편의점 브랜드와 관계없이 행사상품 한 건을 같은 형태로 표현한다.
public record PromotionProduct(
        ConvenienceBrand brand,
        String name,
        int price,
        String imageUrl,
        ProductCategory category,
        PromotionType promotionType
) {

    public PromotionProduct {
        if (brand == null || category == null || promotionType == null) {
            throw new IllegalArgumentException("행사상품의 브랜드, 카테고리, 행사 유형이 필요합니다.");
        }
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("행사상품 이름이 필요합니다.");
        }
        if (price < 0) {
            throw new IllegalArgumentException("행사상품 가격은 0 이상이어야 합니다.");
        }
        if (!isAbsoluteHttpUrl(imageUrl)) {
            throw new IllegalArgumentException("행사상품 이미지 주소는 절대 HTTP URL이어야 합니다.");
        }
    }

    private static boolean isAbsoluteHttpUrl(final String url) {
        if (url == null || url.isBlank()) {
            return false;
        }
        URI uri = URI.create(url);
        return uri.getHost() != null
                && ("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()));
    }
}
