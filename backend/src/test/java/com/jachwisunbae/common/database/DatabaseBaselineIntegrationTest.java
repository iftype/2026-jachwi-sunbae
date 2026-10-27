package com.jachwisunbae.common.database;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.common.config.LocalDatabaseSampleConfig;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.FlywayException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class DatabaseBaselineIntegrationTest {

    @Container
    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.10");

    private DataSource dataSource;
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUpDatabase() {
        String databaseName = "flyway_test_" + UUID.randomUUID().toString().replace("-", "");
        DataSource admin = new DriverManagerDataSource(
                MYSQL.getJdbcUrl(), "root", MYSQL.getPassword());
        new JdbcTemplate(admin).execute("CREATE DATABASE `" + databaseName + "`");
        dataSource = new DriverManagerDataSource(
                "jdbc:mysql://" + MYSQL.getHost() + ":" + MYSQL.getMappedPort(3306) + "/" + databaseName,
                "root", MYSQL.getPassword());
        jdbcTemplate = new JdbcTemplate(dataSource);
    }

    @Test
    @DisplayName("빈 DB에 마이그레이션하면 시스템 체크 항목만 기본 데이터로 들어간다")
    void migratesAnEmptyDatabaseWithSystemItems() {
        Flyway flyway = flyway();
        assertThat(flyway.migrate().migrationsExecuted).isEqualTo(6);
        assertThat(jdbcTemplate.queryForList(
                "SELECT script FROM flyway_schema_history ORDER BY installed_rank", String.class))
                .containsExactly("V1__initial_schema.sql", "V2__add_bus_stops_coordinate_index.sql",
                        "V3__introduce_anonymous_authentication.sql", "V4__create_weather_forecasts.sql",
                        "V5__create_weather_user_features.sql", "V6__create_street_memos.sql");
        assertAnonymousMemberSchema();
        assertEmptyWeatherTables();
        flyway.validate();
        assertThat(flyway.migrate().migrationsExecuted).isZero();

        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM system_check_items", Integer.class)).isEqualTo(14);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM rental_transactions", Integer.class)).isZero();
    }

    @Test
    @DisplayName("빈 DB에 V6까지 적용해도 버스정류장 좌표 인덱스가 위도·경도 순서로 생성된다")
    void migratesAnEmptyDatabaseUpToBusStopCoordinateIndex() {
        flyway().migrate();

        assertThat(history()).containsExactly("1:SQL:1", "2:SQL:1", "3:SQL:1", "4:SQL:1", "5:SQL:1", "6:SQL:1");
        assertThat(busStopCoordinateIndexColumns()).containsExactly("latitude", "longitude");
    }

    @Test
    @DisplayName("기존 스키마 DB에 버전 1 기준선을 등록하면 기존 데이터를 유지한 채 V2–V6를 적용한다")
    void oneTimeBaselinePreservesExistingMembersChecklistsAndSystemItems() {
        new ResourceDatabasePopulator(
                new ClassPathResource("db/migration/V1__initial_schema.sql")).execute(dataSource);
        jdbcTemplate.update("""
                INSERT INTO members (id, nickname, created_at, updated_at)
                VALUES (999, '기준선 사용자', NOW(6), NOW(6))
                """);
        jdbcTemplate.update("""
                INSERT INTO user_checklists (id, member_id, name, stage, created_at)
                VALUES (999, 999, '보존할 체크리스트', 'ON_SITE', NOW(6))
                """);
        jdbcTemplate.update("""
                UPDATE system_check_items SET question = '기존 운영 질문', deleted_at = NOW(6)
                WHERE id = 101
                """);
        insertBusStop("existing", "기존 정류장");
        var busStopsBefore = jdbcTemplate.queryForList("SELECT * FROM bus_stops ORDER BY id");
        var membersBefore = jdbcTemplate.queryForList("SELECT id, created_at, updated_at FROM members ORDER BY id");
        var checklistsBefore = jdbcTemplate.queryForList("SELECT * FROM user_checklists ORDER BY id");
        var systemItemsBefore = jdbcTemplate.queryForList("SELECT * FROM system_check_items ORDER BY id");
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .baselineVersion("1")
                .baselineOnMigrate(true)
                .load();

        assertThat(flyway.migrate().migrationsExecuted).isEqualTo(5);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM bus_stops ORDER BY id")).isEqualTo(busStopsBefore);
        assertThat(jdbcTemplate.queryForList("SELECT id, created_at, updated_at FROM members ORDER BY id"))
                .isEqualTo(membersBefore);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM user_checklists ORDER BY id")).isEqualTo(checklistsBefore);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM system_check_items ORDER BY id")).isEqualTo(systemItemsBefore);
        assertThat(history()).containsExactly("1:BASELINE:1", "2:SQL:1", "3:SQL:1", "4:SQL:1", "5:SQL:1", "6:SQL:1");
        assertThat(busStopCoordinateIndexColumns()).containsExactly("latitude", "longitude");
    }

    // 수동 인덱스가 있는 DB의 실패와 정상 편입을 서로 다른 일회용 DB에서 검증한다.
    @Test
    @DisplayName("좌표 인덱스를 수동으로 만든 DB는 버전 1 기준선에서 실패하며 실패 이력을 유지한다")
    void manuallyIndexedDatabaseFailsOnVersion1Baseline() {
        prepareManuallyIndexedDatabase();

        assertThatThrownBy(() -> baselineFlyway("1").migrate())
                .isInstanceOf(FlywayException.class)
                .hasMessageContaining("Duplicate key name 'idx_bus_stops_latitude_longitude'");
        assertThat(history()).containsExactly("1:BASELINE:1", "2:SQL:0");
        assertThatThrownBy(() -> flyway().validate()).isInstanceOf(FlywayException.class);
    }

    @Test
    @DisplayName("좌표 인덱스를 수동으로 만든 별도 DB는 버전 2 기준선으로 편입된다")
    void manuallyIndexedDatabaseJoinsOnVersion2Baseline() {
        prepareManuallyIndexedDatabase();
        var busStopsBefore = jdbcTemplate.queryForList("SELECT * FROM bus_stops ORDER BY id");

        assertThat(baselineFlyway("2").migrate().migrationsExecuted).isEqualTo(4);
        assertThat(history()).containsExactly("2:BASELINE:1", "3:SQL:1", "4:SQL:1", "5:SQL:1", "6:SQL:1");
        assertThat(busStopCoordinateIndexColumns()).containsExactly("latitude", "longitude");
        assertThat(jdbcTemplate.queryForList("SELECT * FROM bus_stops ORDER BY id")).isEqualTo(busStopsBefore);
        flyway().validate();
        assertThat(flyway().migrate().migrationsExecuted).isZero();
    }

    private void prepareManuallyIndexedDatabase() {
        new ResourceDatabasePopulator(
                new ClassPathResource("db/migration/V1__initial_schema.sql")).execute(dataSource);
        jdbcTemplate.execute("""
                ALTER TABLE bus_stops
                ADD INDEX idx_bus_stops_latitude_longitude (latitude, longitude), ALGORITHM=INPLACE, LOCK=NONE
                """);
        insertBusStop("existing", "기존 정류장");
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 2})
    @DisplayName("V1·V2 DB를 V6로 올리면 회원·매물·체크리스트를 보존하고 익명 인증과 날씨 테이블을 생성한다")
    void upgradesLegacyMembersAndRecords(final int version) {
        Flyway.configure().dataSource(dataSource).target(Integer.toString(version)).load().migrate();
        // 인증 V3 적용 전에는 닉네임·비밀번호가 있는 기존 회원 스키마를 사용한다.
        jdbcTemplate.update("""
                INSERT INTO members (id, nickname, password_hash, created_at, updated_at)
                VALUES (999, '기존 회원', 'legacy-password-hash', NOW(6), NOW(6))
                """);
        insertMemberRecords();
        insertBusStop("existing", "보존할 정류장");
        var membersBefore = jdbcTemplate.queryForList("SELECT id, created_at, updated_at FROM members ORDER BY id");
        var propertiesBefore = jdbcTemplate.queryForList("SELECT * FROM properties ORDER BY id");
        var checklistsBefore = jdbcTemplate.queryForList("SELECT * FROM user_checklists ORDER BY id");
        var busStopsBefore = jdbcTemplate.queryForList("SELECT * FROM bus_stops ORDER BY id");
        var systemItemsBefore = jdbcTemplate.queryForList("SELECT * FROM system_check_items ORDER BY id");

        assertThat(flyway().migrate().migrationsExecuted).isEqualTo(6 - version);

        assertThat(history()).containsExactly("1:SQL:1", "2:SQL:1", "3:SQL:1", "4:SQL:1", "5:SQL:1", "6:SQL:1");
        assertThat(jdbcTemplate.queryForList("SELECT id, created_at, updated_at FROM members ORDER BY id"))
                .isEqualTo(membersBefore);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM properties ORDER BY id")).isEqualTo(propertiesBefore);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM user_checklists ORDER BY id")).isEqualTo(checklistsBefore);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM bus_stops ORDER BY id")).isEqualTo(busStopsBefore);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM system_check_items ORDER BY id")).isEqualTo(systemItemsBefore);
        assertAnonymousMemberSchema();
        assertEmptyWeatherTables();
        assertThat(flyway().migrate().migrationsExecuted).isZero();
        flyway().validate();
    }

    @Test
    @DisplayName("익명 인증 V3 DB에는 V4~V6를 적용하며 회원·Refresh Token·연관 기록을 보존한다")
    void upgradesAnonymousAuthenticationWithWeatherTables() {
        Flyway.configure().dataSource(dataSource).target("3").load().migrate();
        jdbcTemplate.update("""
                INSERT INTO members (id, created_at, updated_at, deleted_at)
                VALUES (999, NOW(6), NOW(6), NULL), (1000, NOW(6), NOW(6), NOW(6))
                """);
        jdbcTemplate.update("""
                INSERT INTO refresh_tokens (member_id, token_hash, created_at, updated_at, expires_at)
                VALUES (999, ?, NOW(6), NOW(6), DATE_ADD(NOW(6), INTERVAL 365 DAY))
                """, "a".repeat(64));
        insertMemberRecords();
        var membersBefore = jdbcTemplate.queryForList("SELECT * FROM members ORDER BY id");
        var tokensBefore = jdbcTemplate.queryForList("SELECT * FROM refresh_tokens ORDER BY id");
        var propertiesBefore = jdbcTemplate.queryForList("SELECT * FROM properties ORDER BY id");
        var checklistsBefore = jdbcTemplate.queryForList("SELECT * FROM user_checklists ORDER BY id");

        assertThat(flyway().migrate().migrationsExecuted).isEqualTo(3);

        assertThat(history()).containsExactly("1:SQL:1", "2:SQL:1", "3:SQL:1", "4:SQL:1", "5:SQL:1", "6:SQL:1");
        assertThat(jdbcTemplate.queryForList("SELECT * FROM members ORDER BY id")).isEqualTo(membersBefore);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM refresh_tokens ORDER BY id")).isEqualTo(tokensBefore);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM properties ORDER BY id")).isEqualTo(propertiesBefore);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM user_checklists ORDER BY id")).isEqualTo(checklistsBefore);
        assertEmptyWeatherTables();
        flyway().validate();
        assertThat(flyway().migrate().migrationsExecuted).isZero();
    }

    @Test
    @DisplayName("로컬 기동 시 마이그레이션 후 샘플을 적재하고 재기동해도 수정한 샘플을 유지한다")
    void localStartupLoadsSamplesAfterMigrationsAndPreservesThemOnRestart() {
        FlywayMigrationStrategy strategy = new LocalDatabaseSampleConfig().localSampleMigrationStrategy();

        strategy.migrate(flyway());

        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM bus_stops", Integer.class)).isEqualTo(2247);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM good_price_stores", Integer.class)).isEqualTo(369);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM cctvs", Integer.class)).isEqualTo(6706);
        jdbcTemplate.update("UPDATE bus_stops SET name = '보존할 정류장' WHERE node_id = 'GGB204000060'");
        jdbcTemplate.update("UPDATE good_price_stores SET name = '보존할 업소' WHERE name = '돈까스보라'");
        jdbcTemplate.update("UPDATE cctvs SET address = '보존할 주소' WHERE management_number = '202630000000800327'");

        strategy.migrate(flyway());

        assertThat(jdbcTemplate.queryForObject(
                "SELECT name FROM bus_stops WHERE node_id = 'GGB204000060'", String.class)).isEqualTo("보존할 정류장");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM good_price_stores WHERE name = '보존할 업소'", Integer.class)).isOne();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT address FROM cctvs WHERE management_number = '202630000000800327'", String.class))
                .isEqualTo("보존할 주소");
    }

    @Test
    @DisplayName("로컬 기동 시 기존 데이터가 있는 테이블은 두고 빈 샘플 테이블만 채운다")
    void localStartupKeepsExistingDataAndFillsOnlyEmptySampleTables() {
        Flyway flyway = flyway();
        flyway.migrate();
        jdbcTemplate.update("""
                INSERT INTO bus_stops (node_id, name, latitude, longitude, city_code, city_name)
                VALUES ('existing', '기존 전국 정류장', 37.5, 127.0, '11', '서울특별시')
                """);

        new LocalDatabaseSampleConfig().localSampleMigrationStrategy().migrate(flyway);

        assertThat(jdbcTemplate.queryForList("SELECT node_id FROM bus_stops", String.class))
                .containsExactly("existing");
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM good_price_stores", Integer.class)).isEqualTo(369);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM cctvs", Integer.class)).isEqualTo(6706);
    }

    private void insertMemberRecords() {
        jdbcTemplate.update("""
                INSERT INTO properties (id, member_id, name, created_at)
                VALUES (999, 999, '보존할 매물', NOW(6))
                """);
        jdbcTemplate.update("""
                INSERT INTO user_checklists (id, member_id, name, stage, created_at)
                VALUES (999, 999, '보존할 체크리스트', 'ON_SITE', NOW(6))
                """);
    }

    private void assertAnonymousMemberSchema() {
        assertThat(jdbcTemplate.queryForList("""
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = 'members'
                ORDER BY ordinal_position
                """, String.class)).containsExactly("id", "created_at", "updated_at", "deleted_at");
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM refresh_tokens", Integer.class)).isZero();
    }

    private void assertEmptyWeatherTables() {
        List<String> tables = List.of("weather_forecasts", "weather_daily_forecasts", "weather_collection_publications",
                "member_weather_locations", "member_weather_notification_settings",
                "weather_notification_devices", "weather_notifications");
        assertThat(jdbcTemplate.queryForList("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = DATABASE() AND table_name LIKE '%weather%'
                """, String.class)).containsExactlyInAnyOrderElementsOf(tables);
        for (String table : tables) {
            assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class))
                    .as(table).isZero();
        }
    }

    @Test
    @DisplayName("V5 DB를 업그레이드하면 기존 익명 회원을 보존하고 거리 메모와 삭제 시각을 저장한다")
    void upgradesVersion5DatabaseAndStoresStreetMemos() {
        Flyway.configure().dataSource(dataSource).target("5").load().migrate();
        insertStreetMemoAuthor();
        var membersBefore = jdbcTemplate.queryForList("SELECT * FROM members ORDER BY id");

        assertThat(flyway().migrate().migrationsExecuted).isOne();

        assertThat(jdbcTemplate.queryForList("SELECT * FROM members ORDER BY id")).isEqualTo(membersBefore);
        insertStreetMemo(999L, new BigDecimal("37.3948000"), new BigDecimal("127.1112000"), "LIKE");
        assertThat(jdbcTemplate.queryForMap("""
                SELECT member_id, latitude, longitude, memo, preference, deleted_at FROM street_memos
                """))
                .containsEntry("member_id", 999L)
                .containsEntry("latitude", new BigDecimal("37.3948000"))
                .containsEntry("longitude", new BigDecimal("127.1112000"))
                .containsEntry("memo", "이 골목에 무인 세탁소가 있어요 🧺")
                .containsEntry("preference", "LIKE")
                .containsEntry("deleted_at", null);
        assertThat(jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM street_memos WHERE created_at IS NOT NULL AND updated_at IS NOT NULL
                """, Integer.class)).isOne();

        jdbcTemplate.update("UPDATE street_memos SET deleted_at = NOW(6) WHERE member_id = 999");

        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM street_memos WHERE deleted_at IS NOT NULL", Integer.class)).isOne();
        assertThat(flyway().migrate().migrationsExecuted).isZero();
    }

    @Test
    @DisplayName("거리 메모의 위도와 경도 범위 제약을 DB에서도 적용한다")
    void rejectsInvalidStreetMemoCoordinates() {
        flyway().migrate();
        insertStreetMemoAuthor();

        assertThatThrownBy(() -> insertStreetMemo(999L, new BigDecimal("-90.0000001"), BigDecimal.ZERO, "LIKE"))
                .isInstanceOf(DataAccessException.class).hasMessageContaining("chk_street_memos_latitude");
        assertThatThrownBy(() -> insertStreetMemo(999L, BigDecimal.ZERO, new BigDecimal("180.0000001"), "LIKE"))
                .isInstanceOf(DataAccessException.class).hasMessageContaining("chk_street_memos_longitude");
    }

    @Test
    @DisplayName("거리 메모 선호는 올바른 대문자 코드만 허용하며 생략할 수 없다")
    void rejectsInvalidOrMissingStreetMemoPreference() {
        flyway().migrate();
        insertStreetMemoAuthor();

        assertThatThrownBy(() -> insertStreetMemo(999L, BigDecimal.ZERO, BigDecimal.ZERO, "like"))
                .isInstanceOf(DataAccessException.class).hasMessageContaining("preference");
        assertThatThrownBy(() -> insertStreetMemo(999L, BigDecimal.ZERO, BigDecimal.ZERO, "NEUTRAL"))
                .isInstanceOf(DataAccessException.class).hasMessageContaining("preference");
        assertThatThrownBy(() -> jdbcTemplate.update("""
                INSERT INTO street_memos (member_id, latitude, longitude, memo, created_at, updated_at)
                VALUES (999, 37.5, 127.0, '동네 메모', NOW(6), NOW(6))
                """))
                .isInstanceOf(DataAccessException.class).hasMessageContaining("preference");
    }

    private void insertStreetMemoAuthor() {
        jdbcTemplate.update("""
                INSERT INTO members (id, created_at, updated_at)
                VALUES (999, NOW(6), NOW(6))
                """);
    }

    private void insertStreetMemo(Long memberId, BigDecimal latitude, BigDecimal longitude, String preference) {
        jdbcTemplate.update("""
                INSERT INTO street_memos (member_id, latitude, longitude, memo, preference, created_at, updated_at)
                VALUES (?, ?, ?, '이 골목에 무인 세탁소가 있어요 🧺', ?, NOW(6), NOW(6))
                """, memberId, latitude, longitude, preference);
    }

    private Flyway baselineFlyway(String baselineVersion) {
        return Flyway.configure()
                .dataSource(dataSource)
                .baselineVersion(baselineVersion)
                .baselineOnMigrate(true)
                .load();
    }

    private List<String> history() {
        return jdbcTemplate.queryForList("""
                SELECT CONCAT(version, ':', type, ':', success)
                FROM flyway_schema_history
                ORDER BY installed_rank
                """, String.class);
    }

    private List<String> busStopCoordinateIndexColumns() {
        return jdbcTemplate.queryForList("""
                SELECT column_name
                FROM information_schema.statistics
                WHERE table_schema = DATABASE()
                  AND table_name = 'bus_stops'
                  AND index_name = 'idx_bus_stops_latitude_longitude'
                ORDER BY seq_in_index
                """, String.class);
    }

    private void insertBusStop(String nodeId, String name) {
        jdbcTemplate.update("""
                INSERT INTO bus_stops (node_id, name, latitude, longitude, city_code, city_name)
                VALUES (?, ?, 37.3948000, 127.1112000, '31020', '경기도 성남시')
                """, nodeId, name);
    }

    private Flyway flyway() {
        return Flyway.configure()
                .dataSource(dataSource)
                .baselineVersion("1")
                .baselineOnMigrate(false)
                .cleanDisabled(true)
                .validateMigrationNaming(true)
                .load();
    }
}
