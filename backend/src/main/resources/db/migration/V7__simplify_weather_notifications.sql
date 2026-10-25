-- V3~V6 적용 이력을 유지한다. 다른 브랜치의 버전 충돌 조정은 별도 작업이다.
-- 여러 설치가 있던 회원은 가장 최근 갱신한 설치 하나만 유지한다.
DELETE older FROM weather_notification_devices older
JOIN weather_notification_devices newer ON older.member_id = newer.member_id
    AND (older.updated_at < newer.updated_at
        OR (older.updated_at = newer.updated_at AND older.installation_id < newer.installation_id));

ALTER TABLE weather_notification_devices
    DROP INDEX idx_weather_device_member,
    ADD CONSTRAINT uk_weather_device_member UNIQUE (member_id),
    DROP COLUMN registration_version;

ALTER TABLE weather_notifications
    ADD COLUMN title VARCHAR(255) NULL,
    ADD COLUMN body VARCHAR(1000) NULL,
    ADD COLUMN assessments JSON NULL,
    ADD COLUMN result VARCHAR(7) NULL,
    ADD CONSTRAINT chk_weather_notification_result CHECK (result IN ('SUCCESS', 'FAILED'));

UPDATE weather_notifications
SET title = JSON_UNQUOTE(JSON_EXTRACT(snapshot, '$.report.title')),
    body = JSON_UNQUOTE(JSON_EXTRACT(snapshot, '$.report.body')),
    assessments = JSON_EXTRACT(snapshot, '$.report.assessments');

-- 수락 기록이 하나라도 있으면 SUCCESS. 미종료 기록은 NULL로 보존하고 재전송하지 않는다.
UPDATE weather_notifications n
JOIN (
    SELECT notification_id, MAX(status = 'ACCEPTED') AS accepted,
        MAX(status IN ('FAILED', 'UNKNOWN', 'CANCELLED')) AS failed
    FROM weather_notification_deliveries GROUP BY notification_id
) d USING (notification_id)
SET n.result = CASE WHEN d.accepted = 1 THEN 'SUCCESS' WHEN d.failed = 1 THEN 'FAILED' ELSE NULL END;

DROP TABLE weather_notification_deliveries;
ALTER TABLE weather_notifications
    MODIFY title VARCHAR(255) NOT NULL,
    MODIFY body VARCHAR(1000) NOT NULL,
    MODIFY assessments JSON NOT NULL,
    RENAME COLUMN prepared_at TO created_at,
    DROP COLUMN location_observed_at,
    DROP COLUMN expires_at,
    DROP COLUMN snapshot;
