package com.jachwisunbae.property.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.jachwisunbae.property.entity.photo.PropertyPhoto;
import java.time.LocalDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.jdbc.JdbcTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@JdbcTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class JdbcPropertyPhotoRepositoryTest {

    @Container
    @ServiceConnection
    private static final MySQLContainer<?> mysqlContainer = new MySQLContainer<>("mysql:8.4.10");

    private static final long MEMBER_ID = 1L;
    private static final long PROPERTY_ID = 10L;
    private static final long OTHER_PROPERTY_ID = 11L;
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 20, 9, 0);

    private JdbcPropertyPhotoRepository repository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        repository = new JdbcPropertyPhotoRepository(jdbcTemplate);
        jdbcTemplate.update("INSERT INTO members (id, created_at, updated_at) VALUES (?, NOW(6), NOW(6))", MEMBER_ID);
        insertProperty(PROPERTY_ID);
        insertProperty(OTHER_PROPERTY_ID);
    }

    @Test
    @DisplayName("사진을 저장하면 생성된 ID와 함께 저장 키, 형식, 크기를 돌려준다")
    void savesPhoto() {
        // when
        PropertyPhoto saved = save(PROPERTY_ID, "photos/1.png", NOW);

        // then
        assertThat(saved.getId()).isPositive();
        assertThat(repository.findByIdAndPropertyId(saved.getId(), PROPERTY_ID)).get()
                .extracting(PropertyPhoto::getStorageKey, PropertyPhoto::getContentType, PropertyPhoto::getSizeBytes)
                .containsExactly("photos/1.png", "image/png", 68L);
    }

    @Test
    @DisplayName("썸네일 저장 키를 함께 저장하고, 없으면 비워 둔다")
    void savesThumbnailStorageKey() {
        // when
        PropertyPhoto withThumbnail = repository.save(MEMBER_ID, PropertyPhoto.create(PROPERTY_ID, "photos/1.png",
                "photos/thumbnails/1.jpg", "image/png", 68L, NOW));
        PropertyPhoto withoutThumbnail = save(PROPERTY_ID, "photos/2.png", NOW);

        // then
        assertThat(repository.findByIdAndPropertyId(withThumbnail.getId(), PROPERTY_ID)).get()
                .extracting(PropertyPhoto::getThumbnailStorageKey).isEqualTo("photos/thumbnails/1.jpg");
        assertThat(repository.findByIdAndPropertyId(withoutThumbnail.getId(), PROPERTY_ID)).get()
                .extracting(PropertyPhoto::hasThumbnail).isEqualTo(false);
    }

    @Test
    @DisplayName("매물의 사진은 올린 순서대로 조회하고 다른 매물의 사진은 섞지 않는다")
    void findsPhotosInUploadOrder() {
        // given
        PropertyPhoto later = save(PROPERTY_ID, "photos/later.png", NOW.plusMinutes(1));
        PropertyPhoto earlier = save(PROPERTY_ID, "photos/earlier.png", NOW);
        save(OTHER_PROPERTY_ID, "photos/other.png", NOW);

        // when & then
        assertThat(repository.findByPropertyId(PROPERTY_ID)).extracting(PropertyPhoto::getId)
                .containsExactly(earlier.getId(), later.getId());
        assertThat(repository.countByPropertyId(PROPERTY_ID)).isEqualTo(2);
    }

    @Test
    @DisplayName("다른 매물의 사진 ID로는 사진을 찾지 못한다")
    void hidesPhotoOfOtherProperty() {
        // given
        PropertyPhoto photo = save(OTHER_PROPERTY_ID, "photos/other.png", NOW);

        // when & then
        assertThat(repository.findByIdAndPropertyId(photo.getId(), PROPERTY_ID)).isEmpty();
    }

    @Test
    @DisplayName("대표 사진이 없으면 가장 먼저 올린 사진을 대표로 정하고, 이미 있으면 바꾸지 않는다")
    void ensuresEarliestPhotoAsRepresentative() {
        // given
        PropertyPhoto earlier = save(PROPERTY_ID, "photos/earlier.png", NOW);
        PropertyPhoto later = save(PROPERTY_ID, "photos/later.png", NOW.plusMinutes(1));

        // when
        repository.ensureRepresentative(PROPERTY_ID);
        Long first = repository.findRepresentativePhotoId(PROPERTY_ID).orElseThrow();
        repository.setRepresentative(PROPERTY_ID, later.getId());
        repository.ensureRepresentative(PROPERTY_ID);

        // then
        assertThat(first).isEqualTo(earlier.getId());
        assertThat(repository.findRepresentativePhotoId(PROPERTY_ID)).contains(later.getId());
    }

    @Test
    @DisplayName("사진이 없으면 대표 사진을 정하지 않는다")
    void leavesRepresentativeEmptyWithoutPhotos() {
        // when
        repository.ensureRepresentative(PROPERTY_ID);

        // then
        assertThat(repository.findRepresentativePhotoId(PROPERTY_ID)).isEmpty();
    }

    @Test
    @DisplayName("대표 사진을 지우면 대표 지정도 함께 지워 다음 사진을 대표로 정할 수 있다")
    void deletesRepresentativePhoto() {
        // given
        PropertyPhoto representative = save(PROPERTY_ID, "photos/first.png", NOW);
        PropertyPhoto next = save(PROPERTY_ID, "photos/second.png", NOW.plusMinutes(1));
        repository.ensureRepresentative(PROPERTY_ID);

        // when
        repository.deleteById(representative.getId());
        repository.ensureRepresentative(PROPERTY_ID);

        // then
        assertThat(repository.findByPropertyId(PROPERTY_ID)).extracting(PropertyPhoto::getId)
                .containsExactly(next.getId());
        assertThat(repository.findRepresentativePhotoId(PROPERTY_ID)).contains(next.getId());
    }

    @Test
    @DisplayName("매물의 사진을 모두 지우면 대표 지정도 지우고 다른 매물의 사진은 남긴다")
    void deletesPhotosOfProperty() {
        // given
        save(PROPERTY_ID, "photos/first.png", NOW);
        save(PROPERTY_ID, "photos/second.png", NOW.plusMinutes(1));
        PropertyPhoto other = save(OTHER_PROPERTY_ID, "photos/other.png", NOW);
        repository.ensureRepresentative(PROPERTY_ID);

        // when
        repository.deleteByPropertyId(PROPERTY_ID);

        // then
        assertThat(repository.findByPropertyId(PROPERTY_ID)).isEmpty();
        assertThat(repository.findRepresentativePhotoId(PROPERTY_ID)).isEmpty();
        assertThat(repository.findByPropertyId(OTHER_PROPERTY_ID)).extracting(PropertyPhoto::getId)
                .containsExactly(other.getId());
    }

    private PropertyPhoto save(long propertyId, String storageKey, LocalDateTime createdAt) {
        return repository.save(MEMBER_ID, PropertyPhoto.create(propertyId, storageKey, "image/png", 68L, createdAt));
    }

    private void insertProperty(long id) {
        jdbcTemplate.update("INSERT INTO properties (id, member_id, name, created_at) VALUES (?, ?, '판교 원룸', NOW(6))",
                id, MEMBER_ID);
    }
}
