package com.jachwisunbae.promotion.provider;

import com.jachwisunbae.promotion.domain.PromotionProduct;
import java.util.List;

// 편의점 브랜드별 행사상품을 공통 모델로 수집한다.
public interface PromotionFetcher {

    List<PromotionProduct> fetch();
}
