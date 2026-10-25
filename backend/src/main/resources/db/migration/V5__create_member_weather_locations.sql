-- 정확한 위경도는 저장하지 않는다. 위치 관련 DATETIME은 UTC Instant로 변환해 저장한다.
CREATE TABLE member_weather_locations (
    member_id BIGINT NOT NULL,
    grid_x SMALLINT UNSIGNED NULL,
    grid_y SMALLINT UNSIGNED NULL,
    location_observed_at DATETIME(6) NULL COMMENT '기기의 실제 위치 확인시각 (UTC)',
    synced_at DATETIME(6) NOT NULL COMMENT '서버 동기화 또는 해제시각 (UTC)',
    invalidated_at DATETIME(6) NULL COMMENT '해제 이전에 획득한 위치의 재등록 방지 기준 (UTC)',
    PRIMARY KEY (member_id),
    CONSTRAINT fk_member_weather_location_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    CONSTRAINT chk_member_weather_location_grid CHECK (
        (grid_x IS NULL AND grid_y IS NULL)
        OR (grid_x IS NOT NULL AND grid_y IS NOT NULL AND location_observed_at IS NOT NULL
            AND grid_x BETWEEN 1 AND 149 AND grid_y BETWEEN 1 AND 253)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
