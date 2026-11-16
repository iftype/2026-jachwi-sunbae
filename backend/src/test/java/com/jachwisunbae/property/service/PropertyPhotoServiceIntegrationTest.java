package com.jachwisunbae.property.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.jachwisunbae.common.exception.JachwiException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.UpstreamServiceException;
import com.jachwisunbae.property.entity.photo.PropertyPhoto;
import com.jachwisunbae.property.repository.JdbcPropertyPhotoRepository;
import com.jachwisunbae.property.service.dto.result.PropertyPhotoUploadResult;
import com.jachwisunbae.property.storage.PhotoContent;
import com.jachwisunbae.property.storage.PhotoStorage;
import com.jachwisunbae.property.storage.PhotoStream;
import java.io.InputStream;
import java.util.Base64;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

// 사진 파일은 S3에 올라가므로 저장소만 대역으로 두고, 사진 메타데이터와 대표 사진은 실제 MySQL로 검증한다.
@Testcontainers
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PropertyPhotoServiceIntegrationTest {

    @Container
    @ServiceConnection
    private static final MySQLContainer<?> mysqlContainer = new MySQLContainer<>("mysql:8.4.10");

    private static final long MEMBER_ID = 1L;
    private static final long OTHER_MEMBER_ID = 2L;
    private static final long PROPERTY_ID = 10L;
    private static final long OTHER_PROPERTY_ID = 11L;
    private static final byte[] PNG = Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");

    @Autowired
    private PropertyPhotoService service;

    @Autowired
    private JdbcPropertyPhotoRepository repository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockitoBean
    private PhotoStorage photoStorage;

    @BeforeEach
    void setUp() {
        insertMember(MEMBER_ID);
        insertMember(OTHER_MEMBER_ID);
        insertProperty(PROPERTY_ID, MEMBER_ID);
        insertProperty(OTHER_PROPERTY_ID, OTHER_MEMBER_ID);
    }

    @Test
    @DisplayName("사진을 올리면 저장소에 올리고 첫 사진을 대표 사진으로 정한다")
    void uploadsFirstPhotoAsRepresentative() {
        // when
        PropertyPhotoUploadResult first = service.upload(MEMBER_ID, PROPERTY_ID, png());
        PropertyPhotoUploadResult second = service.upload(MEMBER_ID, PROPERTY_ID, png());

        // then
        assertThat(first.representative()).isTrue();
        assertThat(second.representative()).isFalse();
        assertThat(repository.findRepresentativePhotoId(PROPERTY_ID)).contains(first.photo().getId());
        assertThat(first.photo()).extracting(PropertyPhoto::getContentType, PropertyPhoto::getSizeBytes)
                .containsExactly("image/png", (long) PNG.length);
        verify(photoStorage).upload(eq(first.photo().getStorageKey()), any(byte[].class), eq("image/png"));
    }

    @Test
    @DisplayName("매물당 사진은 30장까지 올릴 수 있고 넘으면 저장소에 올리지 않는다")
    void limitsPhotosPerProperty() {
        // given
        for (int count = 0; count < 30; count++) {
            insertPhoto(PROPERTY_ID, MEMBER_ID, "photos/" + count + ".png");
        }

        // when & then
        assertError(() -> service.upload(MEMBER_ID, PROPERTY_ID, png()), ErrorCode.PHOTO_LIMIT_EXCEEDED);
        assertThat(repository.countByPropertyId(PROPERTY_ID)).isEqualTo(30);
        verifyNoInteractions(photoStorage);
    }

    @Test
    @DisplayName("대표 사진을 지우면 저장소에서도 지우고 남은 첫 사진을 대표로 정한다")
    void deletesRepresentativePhoto() {
        // given
        PropertyPhoto representative = service.upload(MEMBER_ID, PROPERTY_ID, png()).photo();
        PropertyPhoto next = service.upload(MEMBER_ID, PROPERTY_ID, png()).photo();

        // when
        service.delete(MEMBER_ID, PROPERTY_ID, representative.getId());

        // then
        verify(photoStorage).delete(representative.getStorageKey());
        assertThat(repository.findByPropertyId(PROPERTY_ID)).extracting(PropertyPhoto::getId)
                .containsExactly(next.getId());
        assertThat(repository.findRepresentativePhotoId(PROPERTY_ID)).contains(next.getId());
    }

    @Test
    @DisplayName("고른 사진을 대표 사진으로 바꾸고 조회할 때 함께 보여 준다")
    void designatesRepresentative() {
        // given
        service.upload(MEMBER_ID, PROPERTY_ID, png());
        PropertyPhoto chosen = service.upload(MEMBER_ID, PROPERTY_ID, png()).photo();

        // when
        service.designateRepresentative(MEMBER_ID, PROPERTY_ID, chosen.getId());

        // then
        assertThat(service.find(MEMBER_ID, PROPERTY_ID).representativePhotoId()).isEqualTo(chosen.getId());
    }

    @Test
    @DisplayName("사진 내용은 저장소에서 읽어 저장된 형식과 함께 돌려준다")
    void findsPhotoContent() {
        // given
        PropertyPhoto photo = service.upload(MEMBER_ID, PROPERTY_ID, png()).photo();
        given(photoStorage.download(photo.getStorageKey())).willReturn(PNG);

        // when
        PhotoContent content = service.findContent(MEMBER_ID, PROPERTY_ID, photo.getId());

        // then
        assertThat(content.bytes()).isEqualTo(PNG);
        assertThat(content.contentType()).isEqualTo("image/png");
    }

    @Test
    @DisplayName("다른 회원의 매물에는 사진을 올리거나 보거나 지울 수 없다")
    void rejectsOtherMembersProperty() {
        // given
        long photoId = insertPhoto(OTHER_PROPERTY_ID, OTHER_MEMBER_ID, "photos/other.png");

        // when & then
        assertError(() -> service.upload(MEMBER_ID, OTHER_PROPERTY_ID, png()), ErrorCode.PROPERTY_NOT_FOUND);
        assertError(() -> service.find(MEMBER_ID, OTHER_PROPERTY_ID), ErrorCode.PROPERTY_NOT_FOUND);
        assertError(() -> service.delete(MEMBER_ID, OTHER_PROPERTY_ID, photoId), ErrorCode.PROPERTY_NOT_FOUND);
        verifyNoInteractions(photoStorage);
        assertThat(repository.countByPropertyId(OTHER_PROPERTY_ID)).isOne();
    }

    @Test
    @DisplayName("다른 매물의 사진은 대표로 정하거나 지울 수 없다")
    void rejectsPhotoOfOtherProperty() {
        // given
        long photoId = insertPhoto(OTHER_PROPERTY_ID, OTHER_MEMBER_ID, "photos/other.png");

        // when & then
        assertError(() -> service.designateRepresentative(MEMBER_ID, PROPERTY_ID, photoId), ErrorCode.PHOTO_NOT_FOUND);
        assertError(() -> service.delete(MEMBER_ID, PROPERTY_ID, photoId), ErrorCode.PHOTO_NOT_FOUND);
        verify(photoStorage, never()).delete(anyString());
    }

    @Test
    @DisplayName("사진을 올리면 썸네일도 JPEG로 만들어 저장하고 저장 키를 기록한다")
    void uploadsThumbnail() {
        // when
        PropertyPhoto photo = service.upload(MEMBER_ID, PROPERTY_ID, png()).photo();

        // then
        assertThat(photo.getThumbnailStorageKey()).endsWith("/thumbnails/"
                + photo.getStorageKey().substring(photo.getStorageKey().lastIndexOf('/') + 1).replace(".png", ".jpg"));
        verify(photoStorage).upload(eq(photo.getThumbnailStorageKey()), any(byte[].class), eq("image/jpeg"));
        assertThat(repository.findByIdAndPropertyId(photo.getId(), PROPERTY_ID).orElseThrow()
                .getThumbnailStorageKey()).isEqualTo(photo.getThumbnailStorageKey());
    }

    @Test
    @DisplayName("썸네일을 올리지 못하면 원본도 저장소에서 지우고 사진을 저장하지 않는다")
    void compensatesWhenThumbnailUploadFails() {
        // given
        willThrow(new UpstreamServiceException(ErrorCode.PHOTO_STORAGE_FAILURE, "썸네일 업로드 실패"))
                .given(photoStorage).upload(anyString(), any(byte[].class), eq("image/jpeg"));

        // when & then
        assertError(() -> service.upload(MEMBER_ID, PROPERTY_ID, png()), ErrorCode.PHOTO_STORAGE_FAILURE);
        verify(photoStorage).delete(argThat(key -> !key.contains("/thumbnails/")));
        verify(photoStorage).delete(argThat(key -> key.contains("/thumbnails/")));
        assertThat(repository.countByPropertyId(PROPERTY_ID)).isZero();
    }

    @Test
    @DisplayName("썸네일 조회는 썸네일이 있으면 썸네일을, 없으면 원본을 돌려준다")
    void opensThumbnailOrOriginal() {
        // given
        PropertyPhoto withThumbnail = service.upload(MEMBER_ID, PROPERTY_ID, png()).photo();
        long withoutThumbnail = insertPhoto(PROPERTY_ID, MEMBER_ID, "photos/legacy.png");
        given(photoStorage.openStream(anyString()))
                .willAnswer(invocation -> new PhotoStream(InputStream.nullInputStream(), 0, "application/octet-stream"));

        // when
        PhotoStream thumbnail = service.openThumbnail(MEMBER_ID, PROPERTY_ID, withThumbnail.getId());
        PhotoStream original = service.openThumbnail(MEMBER_ID, PROPERTY_ID, withoutThumbnail);

        // then
        verify(photoStorage).openStream(withThumbnail.getThumbnailStorageKey());
        verify(photoStorage).openStream("photos/legacy.png");
        assertThat(thumbnail.contentType()).isEqualTo("image/jpeg");
        assertThat(original.contentType()).isEqualTo("image/png");
    }

    @Test
    @DisplayName("사진을 지우면 썸네일도 저장소에서 지운다")
    void deletesThumbnail() {
        // given
        PropertyPhoto photo = service.upload(MEMBER_ID, PROPERTY_ID, png()).photo();

        // when
        service.delete(MEMBER_ID, PROPERTY_ID, photo.getId());

        // then
        verify(photoStorage).delete(photo.getStorageKey());
        verify(photoStorage).delete(photo.getThumbnailStorageKey());
    }

    private MockMultipartFile png() {
        return new MockMultipartFile("file", "room.png", "image/png", PNG);
    }

    private void assertError(Executable executable, ErrorCode errorCode) {
        assertThatThrownBy(executable::execute)
                .isInstanceOfSatisfying(JachwiException.class,
                        exception -> assertThat(exception.getErrorCode()).isEqualTo(errorCode));
    }

    private void insertMember(long id) {
        jdbcTemplate.update("INSERT INTO members (id, created_at, updated_at) VALUES (?, NOW(6), NOW(6))", id);
    }

    private void insertProperty(long id, long memberId) {
        jdbcTemplate.update("INSERT INTO properties (id, member_id, name, created_at) VALUES (?, ?, '판교 원룸', NOW(6))",
                id, memberId);
    }

    private long insertPhoto(long propertyId, long memberId, String storageKey) {
        jdbcTemplate.update("""
                INSERT INTO property_photos (property_id, member_id, storage_key, content_type, size_bytes, created_at)
                VALUES (?, ?, ?, 'image/png', 68, NOW(6))
                """, propertyId, memberId, storageKey);
        return jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
    }
}
