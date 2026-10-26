-- 시간별 8개 요소의 원본 숫자. 단위 환산·범주 해석은 RAW 계약을 확인한 뒤 수행한다.
-- RAW 결측과 세부 요청시각은 파서·수집 계획에서 검증한다.
-- 모든 시각은 애플리케이션에서 KST로 지정한다. DB 세션 시간대에 의존하는 기본값은 두지 않는다.
CREATE TABLE weather_forecasts (
    grid_x SMALLINT UNSIGNED NOT NULL,
    grid_y SMALLINT UNSIGNED NOT NULL,
    forecast_at DATETIME NOT NULL COMMENT '예보대상시각 (KST)',
    published_at DATETIME NOT NULL COMMENT '8개 요소의 공통 발표시각 (KST)',
    tmp DOUBLE NULL COMMENT 'TMP 원본 기온 (섭씨)',
    sky DOUBLE NULL COMMENT 'SKY 원본 하늘상태 코드',
    pty DOUBLE NULL COMMENT 'PTY 원본 강수형태 코드',
    pop DOUBLE NULL COMMENT 'POP 원본 수치; 강수확률 의미 추가 확인 필요',
    pcp DOUBLE NULL COMMENT 'PCP 원본 수치; 비0 값의 mm 대응 미확인',
    sno DOUBLE NULL COMMENT 'SNO 원본 수치; 비0 값의 cm 대응 미확인',
    reh DOUBLE NULL COMMENT 'REH 원본 상대습도 (%)',
    wsd DOUBLE NULL COMMENT 'WSD 원본 풍속 (m/s)',
    collected_at DATETIME(6) NOT NULL COMMENT '행에 반영한 수집시각 (KST)',
    PRIMARY KEY (grid_x, grid_y, forecast_at),
    CONSTRAINT chk_weather_forecasts_grid CHECK (grid_x BETWEEN 1 AND 149 AND grid_y BETWEEN 1 AND 253),
    CONSTRAINT chk_weather_forecasts_time_order CHECK (forecast_at >= published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 일별 기온은 서로 다른 발표분에서 갱신될 수 있어 요소별로 출처 시각을 보관한다.
CREATE TABLE weather_daily_forecasts (
    grid_x SMALLINT UNSIGNED NOT NULL,
    grid_y SMALLINT UNSIGNED NOT NULL,
    forecast_date DATE NOT NULL COMMENT '예보대상일 (KST)',
    tmn DOUBLE NULL COMMENT 'TMN 원본 일 최저기온 (섭씨)',
    tmn_published_at DATETIME NULL COMMENT 'TMN 발표시각 (KST); 미수집이면 NULL',
    tmn_collected_at DATETIME(6) NULL COMMENT 'TMN에 반영한 수집시각 (KST); 미수집이면 NULL',
    tmx DOUBLE NULL COMMENT 'TMX 원본 일 최고기온 (섭씨)',
    tmx_published_at DATETIME NULL COMMENT 'TMX 발표시각 (KST); 미수집이면 NULL',
    tmx_collected_at DATETIME(6) NULL COMMENT 'TMX에 반영한 수집시각 (KST); 미수집이면 NULL',
    PRIMARY KEY (grid_x, grid_y, forecast_date),
    CONSTRAINT chk_weather_daily_forecasts_grid CHECK (grid_x BETWEEN 1 AND 149 AND grid_y BETWEEN 1 AND 253),
    CONSTRAINT chk_weather_daily_forecasts_source CHECK (
        tmn_published_at IS NOT NULL OR tmx_published_at IS NOT NULL
    ),
    CONSTRAINT chk_weather_daily_forecasts_tmn_metadata CHECK (
        (tmn_published_at IS NULL AND tmn_collected_at IS NULL AND tmn IS NULL)
        OR (tmn_published_at IS NOT NULL AND tmn_collected_at IS NOT NULL)
    ),
    CONSTRAINT chk_weather_daily_forecasts_tmx_metadata CHECK (
        (tmx_published_at IS NULL AND tmx_collected_at IS NULL AND tmx IS NULL)
        OR (tmx_published_at IS NOT NULL AND tmx_collected_at IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 재시작 후에도 수집 완료를 확인한다. 이전 데이터의 성공 여부를 추정해 채우지 않는다.
-- 시각은 KST이며 재수집 중에는 completed_at을 비워 이전 시도의 행이 정상으로 노출되지 않게 한다.
CREATE TABLE weather_collection_publications (
    published_at DATETIME NOT NULL,
    completed_at DATETIME(6) NULL,
    PRIMARY KEY (published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
