-- 재시작 후에도 수집 완료를 확인한다. 이전 데이터의 성공 여부를 추정해 채우지 않는다.
-- 시각은 KST이며 재수집 중에는 completed_at을 비워 이전 시도의 행이 정상으로 노출되지 않게 한다.
CREATE TABLE weather_collection_publications (
    published_at DATETIME NOT NULL,
    started_at DATETIME(6) NOT NULL,
    completed_at DATETIME(6) NULL,
    PRIMARY KEY (published_at),
    CONSTRAINT chk_weather_publication_completion CHECK (completed_at >= started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
