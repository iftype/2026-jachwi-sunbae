-- 목록 카드와 지도 마커에 쓰는 썸네일의 저장 키다. 원본과 같은 버킷에 둔다.
-- 썸네일을 만들지 못한 사진(HEIC, 깨진 이미지)과 기존 사진은 NULL이고, 조회할 때 원본으로 대신한다.
ALTER TABLE property_photos
    ADD COLUMN thumbnail_storage_key VARCHAR(512) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER storage_key;
