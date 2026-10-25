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
    token VARCHAR(4096) CHARACTER SET ascii COLLATE ascii_bin NULL,
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    platform VARCHAR(10) NOT NULL,
    permission VARCHAR(10) NOT NULL,
    active BOOLEAN NOT NULL,
    registration_version BIGINT NOT NULL DEFAULT 1,
    updated_at DATETIME(6) NOT NULL,
    UNIQUE KEY uk_weather_device_token (token_hash),
    KEY idx_weather_device_member (member_id, active),
    CONSTRAINT fk_weather_device_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    CONSTRAINT chk_weather_device_platform CHECK (platform IN ('ANDROID', 'IOS')),
    CONSTRAINT chk_weather_device_permission CHECK (permission IN ('GRANTED', 'DENIED')),
    CONSTRAINT chk_weather_device_active CHECK (NOT active OR (permission = 'GRANTED' AND token IS NOT NULL AND token_hash IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE weather_notifications (
    notification_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    member_id BIGINT NOT NULL,
    send_date DATE NOT NULL,
    slot VARCHAR(10) NOT NULL,
    target_date DATE NOT NULL,
    grid_x SMALLINT UNSIGNED NOT NULL,
    grid_y SMALLINT UNSIGNED NOT NULL,
    location_observed_at DATETIME(6) NOT NULL,
    prepared_at DATETIME(6) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    snapshot JSON NOT NULL,
    UNIQUE KEY uk_weather_notification_member_slot (member_id, send_date, slot),
    CONSTRAINT fk_weather_notification_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    CONSTRAINT chk_weather_notification_slot CHECK (slot IN ('MORNING', 'EVENING')),
    CONSTRAINT chk_weather_notification_grid CHECK (grid_x BETWEEN 1 AND 149 AND grid_y BETWEEN 1 AND 253)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE weather_notification_deliveries (
    notification_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    installation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    registration_version BIGINT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    attempts INT NOT NULL DEFAULT 0,
    next_attempt_at DATETIME(6) NOT NULL,
    claimed_at DATETIME(6) NULL,
    finished_at DATETIME(6) NULL,
    provider_message_id VARCHAR(512) NULL,
    error_code VARCHAR(64) NULL,
    received_at DATETIME(6) NULL,
    opened_at DATETIME(6) NULL,
    PRIMARY KEY (notification_id, installation_id),
    CONSTRAINT fk_weather_delivery_notification FOREIGN KEY (notification_id) REFERENCES weather_notifications(notification_id) ON DELETE CASCADE,
    CONSTRAINT chk_weather_delivery_status CHECK (status IN ('PENDING', 'SENDING', 'ACCEPTED', 'RETRY', 'FAILED', 'UNKNOWN', 'CANCELLED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
