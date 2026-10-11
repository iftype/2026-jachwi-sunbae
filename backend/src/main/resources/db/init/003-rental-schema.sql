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
    area_basis VARCHAR(10) NOT NULL,
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
    CONSTRAINT chk_rental_housing_type CHECK (housing_type IN ('ROWHOUSE', 'DETACHED', 'OFFICETEL')),
    CONSTRAINT chk_rental_area_basis CHECK (
        (housing_type = 'DETACHED' AND area_basis = 'CONTRACT') OR
        (housing_type IN ('ROWHOUSE', 'OFFICETEL') AND area_basis = 'EXCLUSIVE')
    ),
    CONSTRAINT chk_rental_contract_type CHECK (contract_type IN ('NEW', 'RENEWAL', 'UNKNOWN')),
    CONSTRAINT chk_rental_monthly_rent CHECK (monthly_rent_amount_krw > 0),
    CONSTRAINT chk_rental_area CHECK (area_m2 * 121 BETWEEN 2000 AND 4000),
    INDEX idx_rental_dong_date (legal_dong_code, contract_date DESC, id DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
