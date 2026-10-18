-- 버스정류장 좌표 범위 조회 (latitude BETWEEN ... AND longitude BETWEEN ...)가 전체 테이블을 스캔하지 않도록 한다.
-- 성능 테스트 RDS에 수동으로 추가해 검증한 인덱스와 이름·컬럼 순서가 같다.
-- 조회 중에도 쓰기를 막지 않도록 온라인 DDL로 추가한다.
ALTER TABLE bus_stops
    ADD INDEX idx_bus_stops_latitude_longitude (latitude, longitude),
    ALGORITHM=INPLACE,
    LOCK=NONE;
