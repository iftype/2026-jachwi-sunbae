package com.jachwisunbae.property.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.jachwisunbae.property.service.dto.result.PhotoThumbnailBackfillResult;
import com.jachwisunbae.property.storage.PhotoStorage;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

// 기존 사진의 썸네일을 나눠 만드는 흐름을 실제 MySQL로 검증한다. 사진 파일은 저장소 대역으로 둔다.
@Testcontainers
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PropertyPhotoThumbnailBackfillServiceIntegrationTest {

    @Container
    @ServiceConnection
    private static final MySQLContainer<?> mysqlContainer = new MySQLContainer<>("mysql:8.4.10");

    private static final long MEMBER_ID = 1L;
    private static final long PROPERTY_ID = 10L;
    private static final byte[] PNG = Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");
    private static final byte[] HEIC_LIKE = "....ftypheic....".getBytes(StandardCharsets.US_ASCII);

    @Autowired
    private PropertyPhotoThumbnailBackfillService service;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockitoBean
    private PhotoStorage photoStorage;

    @BeforeEach
    void setUp() {
        jdbcTemplate.update("INSERT INTO members (id, created_at, updated_at) VALUES (?, NOW(6), NOW(6))", MEMBER_ID);
        jdbcTemplate.update("INSERT INTO properties (id, member_id, name, created_at) VALUES (?, ?, '판교 원룸', NOW(6))",
                PROPERTY_ID, MEMBER_ID);
    }

    @Test
    @DisplayName("썸네일이 없는 사진을 ID 순서로 나눠 만들고, 다음 요청 위치를 알려 준다")
    void backfillsInBatches() {
        // given
        long first = insertPhoto("photos/members/1/properties/10/a.png");
        long second = insertPhoto("photos/members/1/properties/10/b.png");
        long third = insertPhoto("photos/members/1/properties/10/c.png");
        given(photoStorage.download(anyString())).willReturn(PNG);

        // when
        PhotoThumbnailBackfillResult firstBatch = service.backfill(0, 2);
        PhotoThumbnailBackfillResult secondBatch = service.backfill(firstBatch.lastPhotoId(), 2);

        // then
        assertThat(firstBatch).extracting(PhotoThumbnailBackfillResult::processed,
                PhotoThumbnailBackfillResult::created, PhotoThumbnailBackfillResult::lastPhotoId,
                PhotoThumbnailBackfillResult::hasMore).containsExactly(2, 2, second, true);
        assertThat(secondBatch).extracting(PhotoThumbnailBackfillResult::processed,
                PhotoThumbnailBackfillResult::lastPhotoId, PhotoThumbnailBackfillResult::hasMore)
                .containsExactly(1, third, false);
        assertThat(thumbnailKeyOf(first)).isEqualTo("photos/members/1/properties/10/thumbnails/a.jpg");
        verify(photoStorage).upload(eq("photos/members/1/properties/10/thumbnails/a.jpg"), any(byte[].class),
                eq("image/jpeg"));
    }

    @Test
    @DisplayName("썸네일을 만들 수 없는 사진은 건너뛰고 원본으로 대신하도록 비워 둔다")
    void skipsUnreadablePhoto() {
        // given
        long photoId = insertPhoto("photos/members/1/properties/10/a.heic");
        given(photoStorage.download(anyString())).willReturn(HEIC_LIKE);

        // when
        PhotoThumbnailBackfillResult result = service.backfill(0, 20);

        // then
        assertThat(result.skipped()).isOne();
        assertThat(thumbnailKeyOf(photoId)).isNull();
        verify(photoStorage, never()).upload(anyString(), any(byte[].class), anyString());
    }

    @Test
    @DisplayName("탈퇴로 지워진 사진과 이미 썸네일이 있는 사진은 처리하지 않는다")
    void ignoresDeletedAndDonePhotos() {
        // given
        long deleted = insertPhoto("photos/members/1/properties/10/a.png");
        long done = insertPhoto("photos/members/1/properties/10/b.png");
        jdbcTemplate.update("UPDATE property_photos SET deleted_at = NOW(6) WHERE id = ?", deleted);
        jdbcTemplate.update("UPDATE property_photos SET thumbnail_storage_key = 'photos/t/b.jpg' WHERE id = ?", done);

        // when
        PhotoThumbnailBackfillResult result = service.backfill(0, 20);

        // then
        assertThat(result.processed()).isZero();
        verify(photoStorage, never()).download(anyString());
    }

    private long insertPhoto(String storageKey) {
        jdbcTemplate.update("""
                INSERT INTO property_photos (property_id, member_id, storage_key, content_type, size_bytes, created_at)
                VALUES (?, ?, ?, 'image/png', 68, NOW(6))
                """, PROPERTY_ID, MEMBER_ID, storageKey);
        return jdbcTemplate.queryForObject("SELECT id FROM property_photos WHERE storage_key = ?", Long.class,
                storageKey);
    }

    private String thumbnailKeyOf(long photoId) {
        return jdbcTemplate.queryForObject("SELECT thumbnail_storage_key FROM property_photos WHERE id = ?",
                String.class, photoId);
    }
}
