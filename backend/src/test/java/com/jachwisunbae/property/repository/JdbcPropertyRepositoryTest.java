package com.jachwisunbae.property.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import com.jachwisunbae.property.repository.query.PropertyListItemQuery;
import java.util.List;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

// 매물 목록의 진행률 집계는 MySQL 파생 테이블 쿼리라 실제 MySQL로 검증한다.
@Testcontainers
class JdbcPropertyRepositoryTest {

    @Container
    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.10");

    private static JdbcTemplate jdbcTemplate;
    private static JdbcPropertyRepository propertyRepository;

    @BeforeAll
    static void setUpSchema() {
        DataSource dataSource = new DriverManagerDataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(),
                MYSQL.getPassword());
        Flyway.configure().dataSource(dataSource).load().migrate();
        jdbcTemplate = new JdbcTemplate(dataSource);
        propertyRepository = new JdbcPropertyRepository(jdbcTemplate);
    }

    @BeforeEach
    void clearProperties() {
        jdbcTemplate.update("DELETE FROM property_checklist_items");
        jdbcTemplate.update("DELETE FROM property_checklists");
        jdbcTemplate.update("DELETE FROM property_details");
        jdbcTemplate.update("DELETE FROM properties");
        jdbcTemplate.update("DELETE FROM members");
    }

    @Test
    @DisplayName("매물 목록은 회원의 매물마다 체크 항목 진행률을 집계하고 다른 회원의 항목은 섞지 않는다")
    void countsProgressOfOwnPropertiesOnly() {
        long member = insertMember("me");
        long other = insertMember("other");
        long checked = insertProperty(member, "체크한 집");
        long empty = insertProperty(member, "체크리스트 없는 집");
        long othersProperty = insertProperty(other, "남의 집");
        long onSite = insertChecklist(checked, "ON_SITE");
        insertItem(onSite, 101, "GOOD");
        insertItem(onSite, 102, "CAUTION");
        insertItem(onSite, 103, "UNCONFIRMED");
        long preContract = insertChecklist(checked, "PRE_CONTRACT");
        insertItem(preContract, 201, "GOOD");
        long othersChecklist = insertChecklist(othersProperty, "ON_SITE");
        insertItem(othersChecklist, 101, "GOOD");
        insertItem(othersChecklist, 102, "GOOD");

        List<PropertyListItemQuery> list = propertyRepository.findListByMemberId(member);

        assertThat(list).extracting(PropertyListItemQuery::propertyId, PropertyListItemQuery::totalCount,
                        PropertyListItemQuery::completedCount, PropertyListItemQuery::goodCount,
                        PropertyListItemQuery::cautionCount, PropertyListItemQuery::unconfirmedCount)
                .containsExactly(
                        tuple(empty, 0, 0, 0, 0, 0),
                        tuple(checked, 4, 3, 2, 1, 1));
    }

    @Test
    @DisplayName("삭제한 매물은 목록에도 진행률 집계에도 나오지 않는다")
    void excludesDeletedProperties() {
        long member = insertMember("me");
        long deleted = insertProperty(member, "삭제한 집");
        insertItem(insertChecklist(deleted, "ON_SITE"), 101, "GOOD");
        jdbcTemplate.update("UPDATE properties SET deleted_at = NOW(6) WHERE id = ?", deleted);

        assertThat(propertyRepository.findListByMemberId(member)).isEmpty();
    }

    private long insertMember(final String nickname) {
        jdbcTemplate.update("INSERT INTO members (nickname, created_at, updated_at) VALUES (?, NOW(6), NOW(6))",
                nickname);
        return lastInsertId();
    }

    private long insertProperty(final long memberId, final String name) {
        jdbcTemplate.update("INSERT INTO properties (member_id, name, created_at) VALUES (?, ?, NOW(6))",
                memberId, name);
        return lastInsertId();
    }

    private long insertChecklist(final long propertyId, final String stage) {
        jdbcTemplate.update("""
                INSERT INTO property_checklists (property_id, checklist_name, stage, created_at, updated_at)
                VALUES (?, '기본', ?, NOW(6), NOW(6))
                """, propertyId, stage);
        return lastInsertId();
    }

    private void insertItem(final long checklistId, final long systemCheckItemId, final String status) {
        jdbcTemplate.update("""
                INSERT INTO property_checklist_items
                    (property_checklist_id, system_check_item_id, display_order, status, question, created_at)
                VALUES (?, ?, ?, ?, '질문', NOW(6))
                """, checklistId, systemCheckItemId, systemCheckItemId % 100, status);
    }

    private long lastInsertId() {
        return jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
    }
}
