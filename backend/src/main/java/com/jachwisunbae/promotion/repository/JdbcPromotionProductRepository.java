package com.jachwisunbae.promotion.repository;

import com.jachwisunbae.promotion.domain.ConvenienceBrand;
import com.jachwisunbae.promotion.domain.ProductCategory;
import com.jachwisunbae.promotion.domain.PromotionProduct;
import com.jachwisunbae.promotion.domain.PromotionType;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

// 브랜드별 최신 행사상품 목록을 저장하고 조회한다.
@Repository
public class JdbcPromotionProductRepository {

    private static final int BATCH_SIZE = 1000;
    private static final String INSERT = """
            INSERT INTO promotion_products (brand, name, price, image_url, category, promotion_type, collected_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """;

    private final JdbcTemplate jdbcTemplate;

    public JdbcPromotionProductRepository(final JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    // 삭제와 모든 배치 삽입을 한 트랜잭션으로 처리해 실패하면 이전 목록이 그대로 남는다.
    @Transactional
    public int replaceByBrand(final ConvenienceBrand brand, final List<PromotionProduct> products,
                              final LocalDateTime collectedAt) {
        if (products.isEmpty() || products.stream().anyMatch(product -> product.brand() != brand)) {
            throw new IllegalArgumentException("교체할 브랜드의 비어 있지 않은 상품 목록이 필요합니다.");
        }
        int deletedCount = jdbcTemplate.update("DELETE FROM promotion_products WHERE brand = ?", brand.name());
        jdbcTemplate.batchUpdate(INSERT, products, BATCH_SIZE, (statement, product) -> {
            statement.setString(1, product.brand().name());
            statement.setString(2, product.name());
            statement.setInt(3, product.price());
            statement.setString(4, product.imageUrl());
            statement.setString(5, product.category().name());
            statement.setString(6, product.promotionType().name());
            statement.setObject(7, collectedAt);
        });
        return deletedCount;
    }

    public List<PromotionProduct> findByBrand(final ConvenienceBrand brand) {
        return jdbcTemplate.query("""
                SELECT brand, name, price, image_url, category, promotion_type
                FROM promotion_products WHERE brand = ? ORDER BY id
                """, (row, rowNumber) -> new PromotionProduct(
                ConvenienceBrand.valueOf(row.getString("brand")), row.getString("name"), row.getInt("price"),
                row.getString("image_url"), ProductCategory.valueOf(row.getString("category")),
                PromotionType.valueOf(row.getString("promotion_type"))), brand.name());
    }

    public Optional<LocalDateTime> findLastCollectedAt(final ConvenienceBrand brand) {
        return Optional.ofNullable(jdbcTemplate.queryForObject(
                "SELECT MAX(collected_at) FROM promotion_products WHERE brand = ?", LocalDateTime.class, brand.name()));
    }
}
