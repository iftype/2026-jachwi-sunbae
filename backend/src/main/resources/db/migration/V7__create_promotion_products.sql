-- 브랜드별 최신 수집 결과만 보관한다. id는 상품의 영구 식별자가 아닌 내부 행 식별자다.
CREATE TABLE promotion_products (
    id BIGINT NOT NULL AUTO_INCREMENT,
    brand VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(255) NOT NULL,
    price INT NOT NULL COMMENT '원 단위 판매가격',
    image_url VARCHAR(2048) NOT NULL,
    category VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    promotion_type VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    collected_at DATETIME(6) NOT NULL COMMENT '전체 수집을 마치고 저장에 전달한 시각 (KST)',
    PRIMARY KEY (id),
    INDEX idx_promotion_products_brand_category (brand, category),
    CONSTRAINT chk_promotion_products_price CHECK (price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
