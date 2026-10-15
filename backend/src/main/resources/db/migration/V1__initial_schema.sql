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

-- 대중교통 노선 (국가대중교통정보센터 GTFS의 트램·지하철·버스)
-- GTFS를 다시 적재할 때 네 테이블을 모두 비우고 새로 채운다.
CREATE TABLE IF NOT EXISTS gtfs_routes (
    route_id VARCHAR(100) PRIMARY KEY,
    short_name VARCHAR(100) NOT NULL,
    long_name VARCHAR(300) NOT NULL,
    route_type TINYINT UNSIGNED NOT NULL,
    wait_seconds INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 대중교통 정류장
CREATE TABLE IF NOT EXISTS gtfs_stops (
    stop_id VARCHAR(100) PRIMARY KEY,
    stop_name VARCHAR(150) NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(11, 7) NOT NULL,
    admin_dong_code VARCHAR(10) NULL,
    INDEX idx_gtfs_stops_location (latitude, longitude),
    INDEX idx_gtfs_stops_admin_dong (admin_dong_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 같은 노선에서 연속한 두 정류장 사이의 대표 이동 시간 (운행별 이동 시간의 중앙값)
CREATE TABLE IF NOT EXISTS gtfs_edges (
    route_id VARCHAR(100) NOT NULL,
    from_stop_id VARCHAR(100) NOT NULL,
    to_stop_id VARCHAR(100) NOT NULL,
    travel_seconds INT NOT NULL,
    PRIMARY KEY (route_id, from_stop_id, to_stop_id),
    INDEX idx_gtfs_edges_from (from_stop_id),
    CONSTRAINT fk_gtfs_edges_route FOREIGN KEY (route_id) REFERENCES gtfs_routes (route_id),
    CONSTRAINT fk_gtfs_edges_from_stop FOREIGN KEY (from_stop_id) REFERENCES gtfs_stops (stop_id),
    CONSTRAINT fk_gtfs_edges_to_stop FOREIGN KEY (to_stop_id) REFERENCES gtfs_stops (stop_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 정류장 간 도보 환승 시간
CREATE TABLE IF NOT EXISTS gtfs_transfers (
    from_stop_id VARCHAR(100) NOT NULL,
    to_stop_id VARCHAR(100) NOT NULL,
    transfer_seconds INT NOT NULL,
    PRIMARY KEY (from_stop_id, to_stop_id),
    CONSTRAINT fk_gtfs_transfers_from_stop FOREIGN KEY (from_stop_id) REFERENCES gtfs_stops (stop_id),
    CONSTRAINT fk_gtfs_transfers_to_stop FOREIGN KEY (to_stop_id) REFERENCES gtfs_stops (stop_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 행정동 경계 (통계청 SGIS 행정동 경계를 지도용으로 단순화한 GeoJSON geometry)
-- 다시 적재할 때 모두 비우고 새로 채운다. gtfs_stops.admin_dong_code가 이 코드를 가리키지만,
-- 두 데이터를 따로 적재하므로 외래 키는 두지 않는다.
CREATE TABLE IF NOT EXISTS admin_dongs (
    code VARCHAR(10) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    sido_name VARCHAR(30) NOT NULL,
    sigungu_name VARCHAR(30) NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    center_latitude DECIMAL(10, 7) NOT NULL,
    center_longitude DECIMAL(11, 7) NOT NULL,
    boundary JSON NOT NULL,
    base_date DATE NOT NULL
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

-- 착한가격업소 (행정안전부 착한가격업소 현황 스냅샷)
-- 공공데이터 CSV를 정제 스크립트로 적재하는 참조 데이터다. 애플리케이션은 조회만 한다.
-- 업종, 연락처, 가격은 원본 문자열 그대로 저장한다. 원본에 좌표가 없어 적재 시 주소를 SGIS로 변환한다.
CREATE TABLE IF NOT EXISTS good_price_stores (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    province VARCHAR(30) NOT NULL,
    district VARCHAR(30) NULL,
    business_type VARCHAR(30) NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(30) NULL,
    address VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(11, 7) NOT NULL,
    menu_name_1 VARCHAR(100) NULL,
    menu_price_1 VARCHAR(100) NULL,
    menu_name_2 VARCHAR(100) NULL,
    menu_price_2 VARCHAR(100) NULL,
    menu_name_3 VARCHAR(100) NULL,
    menu_price_3 VARCHAR(100) NULL,
    menu_name_4 VARCHAR(100) NULL,
    menu_price_4 VARCHAR(100) NULL,
    source_date DATE NOT NULL,
    CONSTRAINT chk_good_price_stores_latitude CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_good_price_stores_longitude CHECK (longitude BETWEEN -180 AND 180)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 공공 CCTV (전국CCTV표준데이터 스냅샷)
-- 공공데이터 CSV를 정제 스크립트로 적재하는 참조 데이터다. 애플리케이션은 조회만 한다.
-- 설치목적은 원본 문자열 그대로 저장한다. 화소수와 보관일수는 비어 있거나 애매하면 NULL이다.
CREATE TABLE IF NOT EXISTS cctvs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    management_number VARCHAR(30) NOT NULL,
    address VARCHAR(255) NOT NULL,
    purpose VARCHAR(20) NOT NULL,
    camera_count INT NOT NULL,
    camera_pixels INT NULL,
    retention_days INT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(11, 7) NOT NULL,
    CONSTRAINT uk_cctvs_management_number UNIQUE (management_number),
    CONSTRAINT chk_cctvs_camera_count CHECK (camera_count > 0),
    CONSTRAINT chk_cctvs_latitude CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_cctvs_longitude CHECK (longitude BETWEEN -180 AND 180)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS legal_dongs (
    code CHAR(10) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    name VARCHAR(150) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rental_datasets (
    dataset_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    transaction_sha256 CHAR(64) NULL,
    legal_dong_sha256 CHAR(64) NULL,
    contract_from DATE NULL,
    contract_to DATE NULL,
    collected_at DATETIME(6) NULL,
    imported_at DATETIME(6) NULL,
    row_count INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rental_transactions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    dataset_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    legal_dong_code CHAR(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    housing_type VARCHAR(20) NOT NULL,
    deposit_amount_krw BIGINT UNSIGNED NOT NULL,
    monthly_rent_amount_krw BIGINT UNSIGNED NOT NULL,
    area_m2 DECIMAL(12,4) NOT NULL,
    contract_date DATE NOT NULL,
    contract_type VARCHAR(10) NOT NULL,
    building_name VARCHAR(255) NOT NULL,
    floor VARCHAR(20) NOT NULL,
    contract_period VARCHAR(40) NOT NULL,
    source_file VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    source_row_number BIGINT UNSIGNED NOT NULL,
    CONSTRAINT fk_rental_dataset FOREIGN KEY (dataset_key) REFERENCES rental_datasets (dataset_key),
    CONSTRAINT fk_rental_legal_dong FOREIGN KEY (legal_dong_code) REFERENCES legal_dongs (code),
    CONSTRAINT uk_rental_source_row UNIQUE (dataset_key, source_file, source_row_number),
    INDEX idx_rental_dong_date (legal_dong_code, contract_date DESC, id DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ON_SITE (방문 확인) 시스템 항목 Seed
INSERT INTO system_check_items (id, stage, item_type, question, display_order, created_at, deleted_at) VALUES
(101, 'ON_SITE', 'CORE', '수압(싱크대, 세면대, 샤워기, 변기)이 충분히 강한가요?', 1, NOW(), NULL),
(102, 'ON_SITE', 'CORE', '배수가 원활하고 역류나 악취가 없나요?', 2, NOW(), NULL),
(103, 'ON_SITE', 'CORE', '벽지나 천장에 누수 흔적이나 곰팡이가 없나요?', 3, NOW(), NULL),
(104, 'ON_SITE', 'CORE', '창문 방음과 닫힘 상태가 양호하며 외풍이 없나요?', 4, NOW(), NULL),
(105, 'ON_SITE', 'OPTIONAL', '기본 옵션 가전제품(에어컨, 세탁기, 냉장고 등)이 정상 작동하나요?', 5, NOW(), NULL),
(106, 'ON_SITE', 'OPTIONAL', '방 안 채광과 통풍이 원활한가요?', 6, NOW(), NULL),
(107, 'ON_SITE', 'OPTIONAL', '건물 현관 도어락, CCTV 등 보안 시설이 잘 갖춰져 있나요?', 7, NOW(), NULL),
(108, 'ON_SITE', 'OPTIONAL', '주변 소음(도로, 상가, 층간소음 등)이 심하지 않나요?', 8, NOW(), NULL)
ON DUPLICATE KEY UPDATE
    stage = VALUES(stage),
    item_type = VALUES(item_type),
    question = VALUES(question),
    display_order = VALUES(display_order),
    deleted_at = NULL;

-- PRE_CONTRACT (계약 전 확인) 시스템 항목 Seed
INSERT INTO system_check_items (id, stage, item_type, question, display_order, created_at, deleted_at) VALUES
(201, 'PRE_CONTRACT', 'CORE', '등기부등본상 소유자와 임대인이 일치하나요?', 1, NOW(), NULL),
(202, 'PRE_CONTRACT', 'CORE', '근저당권(융자) 및 선순위 보증금 규모가 위험하지 않은 수준인가요?', 2, NOW(), NULL),
(203, 'PRE_CONTRACT', 'CORE', '건축물대장상 위반건축물 표시가 없나요?', 3, NOW(), NULL),
(204, 'PRE_CONTRACT', 'OPTIONAL', '관리비에 포함된 항목과 실제 부과 내역을 확인했나요?', 4, NOW(), NULL),
(205, 'PRE_CONTRACT', 'OPTIONAL', '특약사항(전세보증보험 가입 불가 시 계약 해제 등)이 명시되어 있나요?', 5, NOW(), NULL),
(206, 'PRE_CONTRACT', 'OPTIONAL', '중개대상물 확인·설명서 내용에 이상이 없나요?', 6, NOW(), NULL)
ON DUPLICATE KEY UPDATE
    stage = VALUES(stage),
    item_type = VALUES(item_type),
    question = VALUES(question),
    display_order = VALUES(display_order),
    deleted_at = NULL;
