-- 회원 (자격정보 통합)
-- 닉네임은 대소문자를 구분해 비교하도록 utf8mb4_bin을 쓴다. MySQL 기본 collation은 대소문자를 무시한다.
-- 같은 닉네임에 비밀번호 없는 회원과 보호된 회원이 하나씩 존재할 수 있다.
CREATE TABLE IF NOT EXISTS members (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nickname VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    password_hash VARCHAR(255) NULL,
    password_protected BOOLEAN AS (password_hash IS NOT NULL) STORED,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    CONSTRAINT uk_members_nickname_protection UNIQUE (nickname, password_protected)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 매물
CREATE TABLE IF NOT EXISTS properties (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT NOT NULL,
    name VARCHAR(30) NOT NULL,
    deposit_amount BIGINT UNSIGNED NOT NULL DEFAULT 0,
    monthly_rent_amount BIGINT UNSIGNED NOT NULL DEFAULT 0,
    address VARCHAR(255) NULL,
    latitude DECIMAL(10, 7) NULL,
    longitude DECIMAL(11, 7) NULL,
    memo VARCHAR(2000) NOT NULL DEFAULT '',
    created_at DATETIME(6) NOT NULL,
    deleted_at DATETIME(6) NULL,
    CONSTRAINT fk_properties_member FOREIGN KEY (member_id) REFERENCES members (id),
    CONSTRAINT uk_properties_id_member UNIQUE (id, member_id),
    CONSTRAINT chk_properties_latitude CHECK (latitude IS NULL OR (latitude BETWEEN -90 AND 90)),
    CONSTRAINT chk_properties_longitude CHECK (longitude IS NULL OR (longitude BETWEEN -180 AND 180))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 매물 부가정보 (1:1)
CREATE TABLE IF NOT EXISTS property_details (
    property_id BIGINT PRIMARY KEY,
    available_move_in_date DATE NULL,
    maintenance_fee_amount BIGINT UNSIGNED NOT NULL DEFAULT 0,
    visit_scheduled_at DATETIME(6) NULL,
    discovery_source VARCHAR(500) NULL,
    created_at DATETIME(6) NOT NULL,
    CONSTRAINT fk_property_details_property FOREIGN KEY (property_id) REFERENCES properties (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 방 옵션 (M:N 매핑)
CREATE TABLE IF NOT EXISTS property_room_options (
    property_id BIGINT NOT NULL,
    option_code VARCHAR(30) NOT NULL,
    PRIMARY KEY (property_id, option_code),
    CONSTRAINT fk_property_room_options_property FOREIGN KEY (property_id) REFERENCES properties (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 관리비 포함 공과금 (M:N 매핑)
CREATE TABLE IF NOT EXISTS property_utility_options (
    property_id BIGINT NOT NULL,
    utility_code VARCHAR(30) NOT NULL,
    PRIMARY KEY (property_id, utility_code),
    CONSTRAINT fk_property_utility_options_property FOREIGN KEY (property_id) REFERENCES properties (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 매물 사진 메타데이터
CREATE TABLE IF NOT EXISTS property_photos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    property_id BIGINT NOT NULL,
    member_id BIGINT NOT NULL,
    storage_key VARCHAR(512) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    content_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    deleted_at DATETIME(6) NULL,
    CONSTRAINT fk_property_photos_property_owner FOREIGN KEY (property_id, member_id)
        REFERENCES properties (id, member_id),
    CONSTRAINT uk_property_photos_property_id_id UNIQUE (property_id, id),
    INDEX idx_property_photos_lookup (property_id, deleted_at, created_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 매물 대표 사진
CREATE TABLE IF NOT EXISTS main_property_photos (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    property_id BIGINT NOT NULL UNIQUE,
    property_photos_id BIGINT NOT NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_main_photos_property FOREIGN KEY (property_id) REFERENCES properties (id),
    CONSTRAINT fk_main_photos_photo FOREIGN KEY (property_id, property_photos_id) REFERENCES property_photos (property_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 시스템 체크 항목 (ONLINE_PHONE 제외)
CREATE TABLE IF NOT EXISTS system_check_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    stage VARCHAR(30) NOT NULL,
    item_type VARCHAR(20) NOT NULL,
    question VARCHAR(200) NOT NULL,
    display_order SMALLINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL,
    deleted_at DATETIME(6) NULL,
    CONSTRAINT chk_system_check_items_stage CHECK (stage IN ('ON_SITE', 'PRE_CONTRACT')),
    CONSTRAINT chk_system_check_items_type CHECK (item_type IN ('CORE', 'OPTIONAL')),
    INDEX idx_system_check_items_stage_order (stage, deleted_at, item_type, display_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 사용자 체크리스트 (ONLINE_PHONE 제외)
CREATE TABLE IF NOT EXISTS user_checklists (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT NOT NULL,
    name VARCHAR(30) NOT NULL,
    stage VARCHAR(30) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    deleted_at DATETIME(6) NULL,
    CONSTRAINT fk_user_checklists_member FOREIGN KEY (member_id) REFERENCES members (id),
    CONSTRAINT chk_user_checklists_stage CHECK (stage IN ('ON_SITE', 'PRE_CONTRACT'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 사용자 체크리스트 항목
CREATE TABLE IF NOT EXISTS user_checklist_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_checklist_id BIGINT UNSIGNED NOT NULL,
    system_check_item_id BIGINT UNSIGNED NULL,
    stage VARCHAR(30) NULL,
    item_type VARCHAR(20) NULL,
    question VARCHAR(200) NULL,
    display_order SMALLINT UNSIGNED NOT NULL,
    CONSTRAINT fk_user_checklist_items_checklist FOREIGN KEY (user_checklist_id) REFERENCES user_checklists (id),
    CONSTRAINT fk_user_checklist_items_item FOREIGN KEY (system_check_item_id) REFERENCES system_check_items (id),
    CONSTRAINT uk_user_checklist_system_item UNIQUE (user_checklist_id, system_check_item_id),
    CONSTRAINT uk_user_checklist_display_order UNIQUE (user_checklist_id, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 회원 단계별 최근 선택 체크리스트
CREATE TABLE IF NOT EXISTS member_checklist_preferences (
    member_id BIGINT NOT NULL,
    stage VARCHAR(30) NOT NULL,
    user_checklist_id BIGINT UNSIGNED NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (member_id, stage),
    CONSTRAINT fk_member_pref_member FOREIGN KEY (member_id) REFERENCES members (id),
    CONSTRAINT fk_member_pref_checklist FOREIGN KEY (user_checklist_id) REFERENCES user_checklists (id),
    CONSTRAINT chk_member_pref_stage CHECK (stage IN ('ON_SITE', 'PRE_CONTRACT'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 매물 적용 체크리스트 스냅샷
CREATE TABLE IF NOT EXISTS property_checklists (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    property_id BIGINT NOT NULL,
    user_checklist_id BIGINT UNSIGNED NULL,
    checklist_name VARCHAR(30) NOT NULL,
    stage VARCHAR(30) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    CONSTRAINT fk_property_checklists_property FOREIGN KEY (property_id) REFERENCES properties (id),
    CONSTRAINT fk_property_checklists_user_checklist FOREIGN KEY (user_checklist_id) REFERENCES user_checklists (id),
    CONSTRAINT uk_property_checklists_property_stage UNIQUE (property_id, stage),
    CONSTRAINT chk_property_checklists_stage CHECK (stage IN ('ON_SITE', 'PRE_CONTRACT'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 매물 체크 항목 스냅샷
CREATE TABLE IF NOT EXISTS property_checklist_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    property_checklist_id BIGINT UNSIGNED NOT NULL,
    system_check_item_id BIGINT UNSIGNED NULL,
    display_order SMALLINT UNSIGNED NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'UNCONFIRMED',
    memo VARCHAR(500) NOT NULL DEFAULT '',
    question VARCHAR(200) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    CONSTRAINT fk_prop_check_items_checklist FOREIGN KEY (property_checklist_id) REFERENCES property_checklists (id),
    CONSTRAINT fk_prop_check_items_system_item FOREIGN KEY (system_check_item_id) REFERENCES system_check_items (id),
    CONSTRAINT uk_prop_check_items_item UNIQUE (property_checklist_id, system_check_item_id),
    CONSTRAINT uk_prop_check_items_order UNIQUE (property_checklist_id, display_order),
    CONSTRAINT chk_prop_check_items_status CHECK (status IN ('UNCONFIRMED', 'GOOD', 'CAUTION'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 버스정류장 (국토교통부 전국 버스정류장 위치정보 스냅샷)
-- 공공데이터 CSV를 정제 스크립트로 적재하는 참조 데이터다. 애플리케이션은 조회만 한다.
CREATE TABLE IF NOT EXISTS bus_stops (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    node_id VARCHAR(20) NOT NULL,
    name VARCHAR(50) NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(11, 7) NOT NULL,
    city_code VARCHAR(5) NOT NULL,
    city_name VARCHAR(30) NOT NULL,
    CONSTRAINT uk_bus_stops_node_id UNIQUE (node_id),
    CONSTRAINT chk_bus_stops_latitude CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_bus_stops_longitude CHECK (longitude BETWEEN -180 AND 180)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
