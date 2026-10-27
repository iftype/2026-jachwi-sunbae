CREATE TABLE street_memos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(11, 7) NOT NULL,
    memo TEXT NOT NULL,
    preference VARCHAR(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    deleted_at DATETIME(6) NULL,
    CONSTRAINT fk_street_memos_member FOREIGN KEY (member_id) REFERENCES members (id),
    CONSTRAINT chk_street_memos_latitude CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_street_memos_longitude CHECK (longitude BETWEEN -180 AND 180),
    CONSTRAINT chk_street_memos_preference CHECK (preference IN ('LIKE', 'DISLIKE')),
    INDEX idx_street_memos_location (deleted_at, latitude, longitude)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
