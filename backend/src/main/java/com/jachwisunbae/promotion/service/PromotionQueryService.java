package com.jachwisunbae.promotion.service;

import com.jachwisunbae.promotion.domain.ConvenienceBrand;
import com.jachwisunbae.promotion.domain.PromotionProduct;
import com.jachwisunbae.promotion.repository.JdbcPromotionProductRepository;
import com.jachwisunbae.promotion.service.dto.result.PromotionProductsResult;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 외부 수집 없이 DB에 저장된 브랜드별 행사상품만 조회한다.
@Service
public class PromotionQueryService {

    private final JdbcPromotionProductRepository repository;

    public PromotionQueryService(final JdbcPromotionProductRepository repository) {
        this.repository = repository;
    }

    // 두 SELECT 사이에 목록이 교체되어도 InnoDB 기본 격리 수준(REPEATABLE READ)에서 같은 스냅샷을 읽는다.
    @Transactional(readOnly = true)
    public PromotionProductsResult findByBrand(final ConvenienceBrand brand) {
        List<PromotionProduct> products = repository.findByBrand(brand);
        LocalDateTime collectedAt = repository.findLastCollectedAt(brand).orElse(null);
        return new PromotionProductsResult(brand, collectedAt, products);
    }
}
