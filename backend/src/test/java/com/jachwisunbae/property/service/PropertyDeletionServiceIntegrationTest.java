package com.jachwisunbae.property.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.jachwisunbae.common.exception.JachwiException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.property.repository.JdbcPropertyRepository;
import com.jachwisunbae.property.storage.PhotoStorage;
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

// 사진 파일은 S3에 올라가므로 저장소만 대역으로 두고, 매물 삭제는 실제 MySQL로 검증한다.
@Testcontainers
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PropertyDeletionServiceIntegrationTest {

    @Container
    @ServiceConnection
    private static final MySQLContainer<?> mysqlContainer = new MySQLContainer<>("mysql:8.4.10");

    private static final long MEMBER_ID = 1L;
    private static final long OTHER_MEMBER_ID = 2L;
    private static final long PROPERTY_ID = 10L;

    @Autowired
    private PropertyDeletionService service;

    @Autowired
    private JdbcPropertyRepository repository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockitoBean
    private PhotoStorage photoStorage;

    @BeforeEach
    void setUp() {
        insertMember(MEMBER_ID);
        insertMember(OTHER_MEMBER_ID);
        jdbcTemplate.update("INSERT INTO properties (id, member_id, name, created_at) VALUES (?, ?, '판교 원룸', NOW(6))",
                PROPERTY_ID, MEMBER_ID);
    }

    @Test
    @DisplayName("매물을 지우면 사진 파일과 썸네일을 저장소에서 지우고 매물은 삭제 시각만 기록해 남긴다")
    void deletesPropertyAndPhotoFiles() {
        // given
        insertPhoto("photos/first.png");
        insertPhoto("photos/second.png");
        jdbcTemplate.update("UPDATE property_photos SET thumbnail_storage_key = 'photos/thumbnails/second.jpg' "
                + "WHERE storage_key = 'photos/second.png'");

        // when
        service.delete(MEMBER_ID, PROPERTY_ID);

        // then
        verify(photoStorage).delete("photos/first.png");
        verify(photoStorage).delete("photos/second.png");
        verify(photoStorage).delete("photos/thumbnails/second.jpg");
        assertThat(repository.findByIdAndMemberId(PROPERTY_ID, MEMBER_ID)).isEmpty();
        assertThat(jdbcTemplate.queryForObject("SELECT deleted_at IS NOT NULL FROM properties WHERE id = ?",
                Boolean.class, PROPERTY_ID)).isTrue();
    }

    @Test
    @DisplayName("다른 회원의 매물은 지울 수 없고 사진 파일도 건드리지 않는다")
    void rejectsOtherMembersProperty() {
        // given
        insertPhoto("photos/first.png");

        // when & then
        assertThatThrownBy(() -> service.delete(OTHER_MEMBER_ID, PROPERTY_ID))
                .isInstanceOfSatisfying(JachwiException.class,
                        exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.PROPERTY_NOT_FOUND));
        verifyNoInteractions(photoStorage);
        assertThat(repository.existsByIdAndMemberId(PROPERTY_ID, MEMBER_ID)).isTrue();
    }

    @Test
    @DisplayName("이미 지운 매물은 다시 지울 수 없다")
    void rejectsDeletedProperty() {
        // given
        service.delete(MEMBER_ID, PROPERTY_ID);

        // when & then
        assertThatThrownBy(() -> service.delete(MEMBER_ID, PROPERTY_ID))
                .isInstanceOfSatisfying(JachwiException.class,
                        exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.PROPERTY_NOT_FOUND));
    }

    private void insertMember(long id) {
        jdbcTemplate.update("INSERT INTO members (id, created_at, updated_at) VALUES (?, NOW(6), NOW(6))", id);
    }

    private void insertPhoto(String storageKey) {
        jdbcTemplate.update("""
                INSERT INTO property_photos (property_id, member_id, storage_key, content_type, size_bytes, created_at)
                VALUES (?, ?, ?, 'image/png', 68, NOW(6))
                """, PROPERTY_ID, MEMBER_ID, storageKey);
    }
}
