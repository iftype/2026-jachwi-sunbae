package com.jachwisunbae.property.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import com.jachwisunbae.property.entity.Property;
import com.jachwisunbae.property.repository.query.PropertyListItemQuery;
import com.jachwisunbae.property.repository.query.PropertyLocationQuery;
import com.jachwisunbae.property.type.RoomOption;
import com.jachwisunbae.property.type.UtilityOption;
import java.math.BigDecimal;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.jdbc.JdbcTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@JdbcTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class JdbcPropertyRepositoryTest {

    @Container
    @ServiceConnection
    private static final MySQLContainer<?> mysqlContainer = new MySQLContainer<>("mysql:8.4.10");

    private static final long MEMBER_ID = 1L;
    private static final long OTHER_MEMBER_ID = 2L;
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 20, 9, 0);

    private JdbcPropertyRepository repository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        repository = new JdbcPropertyRepository(jdbcTemplate);
        insertMember(MEMBER_ID);
        insertMember(OTHER_MEMBER_ID);
    }

    @Test
    @DisplayName("매물을 저장하면 기본 정보, 부가 정보, 옵션을 함께 저장하고 다시 읽을 수 있다")
    void savesPropertyWithDetailsAndOptions() {
        // given
        Property property = Property.create(MEMBER_ID, "판교 원룸", 1000L, 50L, "경기도 성남시 분당구 판교역로 166",
                new BigDecimal("37.3948000"), new BigDecimal("127.1112000"), LocalDate.of(2026, 12, 1), 7L,
                LocalDateTime.of(2026, 11, 10, 14, 0), List.of("BED", "DESK"), List.of("WATER"), "직방", NOW);

        // when
        Property saved = repository.save(property);

        // then
        assertThat(saved.getId()).isPositive();
        Property found = repository.findByIdAndMemberId(saved.getId(), MEMBER_ID).orElseThrow();
        assertThat(found).extracting(Property::getName, Property::getDepositAmount, Property::getMonthlyRentAmount,
                        Property::getAddress, Property::getAvailableMoveInDate, Property::getMaintenanceFeeAmount,
                        Property::getDiscoverySource, Property::getMemo)
                .containsExactly("판교 원룸", 1000L, 50L, "경기도 성남시 분당구 판교역로 166", LocalDate.of(2026, 12, 1), 7L,
                        "직방", "");
        assertThat(found.getLatitude()).isEqualByComparingTo("37.3948");
        assertThat(found.getLongitude()).isEqualByComparingTo("127.1112");
        assertThat(found.getRoomOptions()).containsExactlyInAnyOrder(RoomOption.BED, RoomOption.DESK);
        assertThat(found.getUtilityOptions()).containsExactly(UtilityOption.WATER);
    }

    @Test
    @DisplayName("수정하면 옵션을 새 값으로 바꾼다")
    void replacesOptions() {
        // given
        Property saved = repository.save(Property.create(MEMBER_ID, "옵션 있는 집", 1000L, 50L, null, null, null,
                null, 0L, null, List.of("BED", "DESK"), List.of("WATER"), null, NOW));

        // when
        repository.update(Property.reconstruct(saved.getId(), MEMBER_ID, "옵션 있는 집", 1000L, 50L, null, null,
                null, null, 0L, null, Set.of(RoomOption.BED), Set.of(UtilityOption.INTERNET), null, "", NOW, NOW));

        // then
        Property updated = repository.findByIdAndMemberId(saved.getId(), MEMBER_ID).orElseThrow();
        assertThat(updated.getRoomOptions()).containsExactly(RoomOption.BED);
        assertThat(updated.getUtilityOptions()).containsExactly(UtilityOption.INTERNET);
    }

    @Test
    @DisplayName("메모를 수정하면 다른 정보는 그대로 두고 메모만 바꾼다")
    void updatesMemoOnly() {
        // given
        Property saved = repository.save(Property.create(MEMBER_ID, "메모 쓸 집", 1000L, 50L, null, null, null,
                null, 0L, null, List.of(), List.of(), null, NOW));
        saved.replaceMemo("아침에 해가 잘 든다");

        // when
        repository.updateMemo(saved);

        // then
        assertThat(repository.findByIdAndMemberId(saved.getId(), MEMBER_ID)).get()
                .extracting(Property::getName, Property::getMemo)
                .containsExactly("메모 쓸 집", "아침에 해가 잘 든다");
    }

    @Test
    @DisplayName("다른 회원의 매물은 조회, 존재 확인, 잠금 조회 모두 찾지 못한다")
    void hidesOtherMembersProperty() {
        // given
        long propertyId = insertProperty(OTHER_MEMBER_ID, "남의 집");

        // when & then
        assertThat(repository.findByIdAndMemberId(propertyId, MEMBER_ID)).isEmpty();
        assertThat(repository.findByIdAndMemberIdForUpdate(propertyId, MEMBER_ID)).isEmpty();
        assertThat(repository.existsByIdAndMemberId(propertyId, MEMBER_ID)).isFalse();
        assertThat(repository.existsByIdAndMemberId(propertyId, OTHER_MEMBER_ID)).isTrue();
    }

    @Test
    @DisplayName("삭제하면 행을 남기고 삭제 시각만 기록해 조회, 개수, 목록에서 뺀다")
    void softDeletesProperty() {
        // given
        long deleted = insertProperty(MEMBER_ID, "삭제할 집");
        long kept = insertProperty(MEMBER_ID, "남길 집");

        // when
        repository.deleteById(deleted);

        // then
        assertThat(repository.findByIdAndMemberId(deleted, MEMBER_ID)).isEmpty();
        assertThat(repository.existsByIdAndMemberId(deleted, MEMBER_ID)).isFalse();
        assertThat(repository.countByMemberId(MEMBER_ID)).isOne();
        assertThat(repository.findListByMemberId(MEMBER_ID)).extracting(PropertyListItemQuery::propertyId)
                .containsExactly(kept);
        assertThat(jdbcTemplate.queryForObject("SELECT deleted_at IS NOT NULL FROM properties WHERE id = ?",
                Boolean.class, deleted)).isTrue();
    }

    @Test
    @DisplayName("삭제한 매물은 목록에 나오지 않는다")
    void excludesDeletedProperties() {
        // given
        long deleted = insertProperty(MEMBER_ID, "삭제한 집");
        insertItem(insertChecklist(deleted, "ON_SITE"), 101, "GOOD");
        jdbcTemplate.update("UPDATE properties SET deleted_at = NOW(6) WHERE id = ?", deleted);

        // when & then
        assertThat(repository.findListByMemberId(MEMBER_ID)).isEmpty();
    }

    @Test
    @DisplayName("통근 시간용 매물 위치는 회원의 삭제하지 않은 매물만 ID 내림차순으로 위치 없이도 돌려준다")
    void findsLocationsOfOwnProperties() {
        // given
        long located = insertProperty(MEMBER_ID, "위치 있는 집");
        jdbcTemplate.update("UPDATE properties SET latitude = 37.5000000, longitude = 127.0000000 WHERE id = ?",
                located);
        long unlocated = insertProperty(MEMBER_ID, "위치 없는 집");
        long deleted = insertProperty(MEMBER_ID, "삭제한 집");
        jdbcTemplate.update("UPDATE properties SET deleted_at = NOW(6) WHERE id = ?", deleted);
        insertProperty(OTHER_MEMBER_ID, "남의 집");

        // when
        List<PropertyLocationQuery> locations = repository.findLocationsByMemberId(MEMBER_ID);

        // then
        assertThat(locations).extracting(PropertyLocationQuery::propertyId, PropertyLocationQuery::hasLocation)
                .containsExactly(tuple(unlocated, false), tuple(located, true));
        assertThat(locations.get(1).latitude()).isEqualByComparingTo("37.5");
        assertThat(locations.get(1).longitude()).isEqualByComparingTo("127.0");
    }

    private void insertMember(long id) {
        jdbcTemplate.update("INSERT INTO members (id, created_at, updated_at) VALUES (?, NOW(6), NOW(6))", id);
    }

    private long insertProperty(long memberId, String name) {
        return insert("INSERT INTO properties (member_id, name, created_at) VALUES (?, ?, NOW(6))",
                memberId, name);
    }

    private long insertChecklist(long propertyId, String stage) {
        return insert("""
                INSERT INTO property_checklists (property_id, checklist_name, stage, created_at, updated_at)
                VALUES (?, '기본', ?, NOW(6), NOW(6))
                """, propertyId, stage);
    }

    private void insertItem(long checklistId, long systemCheckItemId, String status) {
        jdbcTemplate.update("""
                INSERT INTO property_checklist_items
                    (property_checklist_id, system_check_item_id, display_order, status, question, created_at)
                VALUES (?, ?, ?, ?, '질문', NOW(6))
                """, checklistId, systemCheckItemId, systemCheckItemId % 100, status);
    }

    private long insert(String sql, Object... args) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            for (int index = 0; index < args.length; index++) {
                statement.setObject(index + 1, args[index]);
            }
            return statement;
        }, keyHolder);
        return keyHolder.getKey().longValue();
    }
}
