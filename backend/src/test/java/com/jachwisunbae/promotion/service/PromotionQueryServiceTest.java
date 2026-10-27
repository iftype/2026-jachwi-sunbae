package com.jachwisunbae.promotion.service;

import static com.jachwisunbae.promotion.support.PromotionProductsFixture.product;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.jachwisunbae.promotion.domain.ConvenienceBrand;
import com.jachwisunbae.promotion.domain.PromotionProduct;
import com.jachwisunbae.promotion.repository.JdbcPromotionProductRepository;
import com.jachwisunbae.promotion.service.dto.result.PromotionProductsResult;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PromotionQueryServiceTest {

    private static final ConvenienceBrand BRAND = ConvenienceBrand.EMART24;
    private static final LocalDateTime COLLECTED_AT = LocalDateTime.of(2026, 10, 27, 4, 2, 13);

    private final JdbcPromotionProductRepository repository = mock(JdbcPromotionProductRepository.class);
    private final PromotionQueryService service = new PromotionQueryService(repository);

    @Test
    @DisplayName("저장된 상품 전체와 마지막 수집 시각을 반환한다")
    void returnsStoredProductsAndTimestamp() {
        List<PromotionProduct> products = List.of(product("첫 상품"), product("다음 상품"));
        when(repository.findByBrand(BRAND)).thenReturn(products);
        when(repository.findLastCollectedAt(BRAND)).thenReturn(Optional.of(COLLECTED_AT));

        PromotionProductsResult result = service.findByBrand(BRAND);

        assertThat(result).isEqualTo(new PromotionProductsResult(BRAND, COLLECTED_AT, products));
    }

    @Test
    @DisplayName("미수집 브랜드는 빈 목록과 null 수집 시각을 반환한다")
    void returnsEmptyUncollectedBrand() {
        when(repository.findByBrand(BRAND)).thenReturn(List.of());
        when(repository.findLastCollectedAt(BRAND)).thenReturn(Optional.empty());

        PromotionProductsResult result = service.findByBrand(BRAND);

        assertThat(result).isEqualTo(new PromotionProductsResult(BRAND, null, List.of()));
    }
}
