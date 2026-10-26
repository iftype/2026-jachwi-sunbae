-- 정확한 위경도는 저장하지 않는다. updated_at은 UTC 기록용이며 위치 유효기간으로 사용하지 않는다.
CREATE TABLE member_weather_locations (
    member_id BIGINT NOT NULL,
    grid_x SMALLINT UNSIGNED NOT NULL,
    grid_y SMALLINT UNSIGNED NOT NULL,
    updated_at DATETIME(6) NOT NULL COMMENT '서버의 마지막 위치 저장시각 (UTC)',
    PRIMARY KEY (member_id),
    CONSTRAINT fk_member_weather_location_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    CONSTRAINT chk_member_weather_location_grid CHECK (
        grid_x BETWEEN 1 AND 149 AND grid_y BETWEEN 1 AND 253
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 날짜·슬롯은 KST, DATETIME(6)은 UTC Instant이다. 푸시 토큰·설치 비밀키는 응답이나 로그에 노출하지 않는다.
CREATE TABLE member_weather_notification_settings (
    member_id BIGINT NOT NULL PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at DATETIME(6) NOT NULL,
    CONSTRAINT fk_weather_notification_settings_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE weather_notification_devices (
    installation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    member_id BIGINT NOT NULL,
    installation_secret_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    token VARCHAR(4096) COLLATE utf8mb4_bin NULL,
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    updated_at DATETIME(6) NOT NULL,
    UNIQUE KEY uk_weather_device_token (token_hash),
    UNIQUE KEY uk_weather_device_member (member_id),
    CONSTRAINT fk_weather_device_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE weather_notifications (
    notification_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    member_id BIGINT NOT NULL,
    send_date DATE NOT NULL,
    slot VARCHAR(10) NOT NULL,
    target_date DATE NOT NULL,
    grid_x SMALLINT UNSIGNED NOT NULL,
    grid_y SMALLINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body VARCHAR(1000) NOT NULL,
    notices JSON NOT NULL,
    UNIQUE KEY uk_weather_notification_member_slot (member_id, send_date, slot),
    CONSTRAINT fk_weather_notification_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    CONSTRAINT chk_weather_notification_slot CHECK (slot IN ('MORNING', 'EVENING')),
    CONSTRAINT chk_weather_notification_grid CHECK (grid_x BETWEEN 1 AND 149 AND grid_y BETWEEN 1 AND 253)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
