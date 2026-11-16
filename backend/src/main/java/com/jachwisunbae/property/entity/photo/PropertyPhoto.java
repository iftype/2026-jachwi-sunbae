package com.jachwisunbae.property.entity.photo;

import lombok.Getter;

import java.time.LocalDateTime;

@Getter
public class PropertyPhoto {

    private static final long MAX_SIZE_BYTES = 10L * 1024 * 1024;
    private final Long id;
    private final Long propertyId;
    private final String storageKey;
    // 목록·지도용 썸네일의 저장 키. 만들지 못한 사진과 썸네일 도입 전 사진은 null이며, 조회할 때 원본으로 대신한다.
    private final String thumbnailStorageKey;
    private final String contentType;
    private final Long sizeBytes;
    private final LocalDateTime createdAt;

    private PropertyPhoto(final Long id, final Long propertyId, final String storageKey,
                           final String thumbnailStorageKey, final String contentType, final Long sizeBytes,
                           final LocalDateTime createdAt) {
        this.id = id;
        this.propertyId = propertyId;
        this.storageKey = storageKey;
        this.thumbnailStorageKey = thumbnailStorageKey;
        this.contentType = contentType;
        this.sizeBytes = sizeBytes;
        this.createdAt = createdAt;
    }

    public static PropertyPhoto create(final Long propertyId, final String storageKey,
                                       final String contentType, final Long sizeBytes,
                                       final LocalDateTime createdAt) {
        return create(propertyId, storageKey, null, contentType, sizeBytes, createdAt);
    }

    public static PropertyPhoto create(final Long propertyId, final String storageKey,
                                       final String thumbnailStorageKey, final String contentType,
                                       final Long sizeBytes, final LocalDateTime createdAt) {
        return new PropertyPhoto(null, validateId(propertyId), validateText(storageKey),
                validateOptionalText(thumbnailStorageKey), validateContentType(contentType),
                validateSize(sizeBytes), requireCreatedAt(createdAt));
    }

    public static PropertyPhoto reconstruct(final Long id, final Long propertyId, final String storageKey,
                                           final String contentType, final Long sizeBytes,
                                           final LocalDateTime createdAt) {
        return reconstruct(id, propertyId, storageKey, null, contentType, sizeBytes, createdAt);
    }

    public static PropertyPhoto reconstruct(final Long id, final Long propertyId, final String storageKey,
                                           final String thumbnailStorageKey, final String contentType,
                                           final Long sizeBytes, final LocalDateTime createdAt) {
        return new PropertyPhoto(id, validateId(propertyId), validateText(storageKey),
                validateOptionalText(thumbnailStorageKey), validateContentType(contentType),
                validateSize(sizeBytes), requireCreatedAt(createdAt));
    }

    public boolean hasThumbnail() {
        return thumbnailStorageKey != null;
    }

    // 매물 ID, 저장 키, 크기, 업로드 시각은 서버가 채우는 값이다.
    // 사용자가 올린 파일의 형식과 크기는 PhotoFile에서 이미 검증했으므로, 여기서 어긋나면 서버 코드 문제다.
    private static Long validateId(final Long id) {
        if (id == null) {
            throw new IllegalArgumentException("사진의 매물 ID는 필수입니다.");
        }
        return id;
    }

    private static String validateText(final String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("사진 저장 키는 필수입니다.");
        }
        return value;
    }

    private static String validateOptionalText(final String value) {
        if (value != null && value.isBlank()) {
            throw new IllegalArgumentException("사진 썸네일 저장 키는 비어 있을 수 없습니다.");
        }
        return value;
    }

    private static String validateContentType(final String value) {
        return PhotoFormat.from(value).contentType();
    }

    private static Long validateSize(final Long sizeBytes) {
        if (sizeBytes == null || sizeBytes < 0 || sizeBytes > MAX_SIZE_BYTES) {
            throw new IllegalArgumentException("사진 크기는 0 이상 10MiB 이하여야 합니다: " + sizeBytes);
        }
        return sizeBytes;
    }

    private static LocalDateTime requireCreatedAt(final LocalDateTime createdAt) {
        if (createdAt == null) {
            throw new IllegalArgumentException("사진 업로드 시각은 필수입니다.");
        }
        return createdAt;
    }
}
