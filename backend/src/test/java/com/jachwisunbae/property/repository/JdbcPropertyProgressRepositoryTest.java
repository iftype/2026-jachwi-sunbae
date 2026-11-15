package com.jachwisunbae.property.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import com.jachwisunbae.checklist.type.CheckStage;
import com.jachwisunbae.checklist.type.CheckStatus;
import com.jachwisunbae.property.repository.query.PropertyChecklistProgressQuery;
import com.jachwisunbae.property.repository.query.PropertyChecklistItemStateQuery;
import com.jachwisunbae.property.repository.query.PropertyProgressSummary;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.jdbc.JdbcTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@JdbcTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class JdbcPropertyProgressRepositoryTest {

    @Container
    @ServiceConnection
    private static final MySQLContainer<?> mysqlContainer = new MySQLContainer<>("mysql:8.4.10");

    private static final long PROPERTY_ID = 10L;

    private JdbcPropertyProgressRepository repository;

    private JdbcPropertyChecklistRepository checklistRepository;

    private JdbcPropertyChecklistItemRepository itemRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        repository = new JdbcPropertyProgressRepository(jdbcTemplate);
        checklistRepository = new JdbcPropertyChecklistRepository(jdbcTemplate);
        itemRepository = new JdbcPropertyChecklistItemRepository(jdbcTemplate);
        jdbcTemplate.update("INSERT INTO members (id, created_at, updated_at) VALUES (1, NOW(6), NOW(6))");
        jdbcTemplate.update("""
                INSERT INTO properties (id, member_id, name, address, latitude, longitude, created_at)
                VALUES (?, 1, '판교 원룸', '경기도 성남시 분당구 판교역로 166', 37.3948, 127.1112, NOW(6))
                """, PROPERTY_ID);
    }

    @Test
    @DisplayName("두 단계의 항목을 모아 완료·괜찮음·주의·미확인 수를 센다")
    void countsBothStages() {
        // given
        long preContract = checklistRepository.save(PROPERTY_ID, null, "계약 전", CheckStage.PRE_CONTRACT);
        itemRepository.saveAll(preContract, List.of(state(1, CheckStatus.GOOD)));
        long onSite = checklistRepository.save(PROPERTY_ID, null, "현장", CheckStage.ON_SITE);
        itemRepository.saveAll(onSite, List.of(state(1, CheckStatus.GOOD), state(2, CheckStatus.CAUTION),
                state(3, CheckStatus.UNCONFIRMED)));

        // when
        PropertyProgressSummary summary = repository.findByPropertyId(PROPERTY_ID);
        List<PropertyChecklistProgressQuery> stages = repository.findByPropertyIdAndStage(PROPERTY_ID);

        // then
        assertThat(summary).extracting(PropertyProgressSummary::totalCount, PropertyProgressSummary::completedCount,
                        PropertyProgressSummary::goodCount, PropertyProgressSummary::cautionCount,
                        PropertyProgressSummary::unconfirmedCount)
                .containsExactly(4, 3, 2, 1, 1);
        assertThat(stages)
                .extracting(PropertyChecklistProgressQuery::stage, stage -> stage.progress().totalCount(),
                        stage -> stage.progress().completedCount())
                .containsExactly(tuple(CheckStage.ON_SITE, 3, 2), tuple(CheckStage.PRE_CONTRACT, 1, 1));
    }

    @Test
    @DisplayName("체크리스트가 없는 매물은 모든 수를 0으로 센다")
    void countsZeroWithoutChecklists() {
        // when
        PropertyProgressSummary summary = repository.findByPropertyId(PROPERTY_ID);

        // then
        assertThat(summary.totalCount()).isZero();
        assertThat(summary.completedCount()).isZero();
        assertThat(repository.findByPropertyIdAndStage(PROPERTY_ID)).isEmpty();
    }

    @Test
    @DisplayName("회원의 매물 단계별 진행 현황을 한 번에 모으고, 삭제한 매물과 다른 회원의 매물은 뺀다")
    void collectsStagesOfMemberProperties() {
        // given
        insertProperty(11L, 1L, null);
        insertProperty(12L, 1L, "NOW(6)");
        jdbcTemplate.update("INSERT INTO members (id, created_at, updated_at) VALUES (2, NOW(6), NOW(6))");
        insertProperty(13L, 2L, null);
        long onSite = checklistRepository.save(PROPERTY_ID, null, "현장", CheckStage.ON_SITE);
        itemRepository.saveAll(onSite, List.of(state(1, CheckStatus.GOOD), state(2, CheckStatus.UNCONFIRMED)));
        long preContract = checklistRepository.save(11L, null, "계약 전", CheckStage.PRE_CONTRACT);
        itemRepository.saveAll(preContract, List.of(state(1, CheckStatus.CAUTION)));
        checklistRepository.save(12L, null, "삭제한 매물", CheckStage.ON_SITE);
        checklistRepository.save(13L, null, "다른 회원", CheckStage.ON_SITE);

        // when
        List<PropertyChecklistProgressQuery> stages = repository.findByMemberIdAndStage(1L);

        // then
        assertThat(stages)
                .extracting(stage -> stage.progress().propertyId(), PropertyChecklistProgressQuery::stage,
                        stage -> stage.progress().totalCount(), stage -> stage.progress().completedCount())
                .containsExactly(tuple(11L, CheckStage.PRE_CONTRACT, 1, 1),
                        tuple(PROPERTY_ID, CheckStage.ON_SITE, 2, 1));
    }

    private void insertProperty(long id, long memberId, String deletedAt) {
        jdbcTemplate.update("""
                INSERT INTO properties (id, member_id, name, address, latitude, longitude, created_at, deleted_at)
                VALUES (?, ?, '판교 원룸', '경기도 성남시 분당구 판교역로 166', 37.3948, 127.1112, NOW(6), %s)
                """.formatted(deletedAt == null ? "NULL" : deletedAt), id, memberId);
    }

    private PropertyChecklistItemStateQuery state(int order, CheckStatus status) {
        return new PropertyChecklistItemStateQuery(null, "질문 " + order, order, status, "");
    }
}
