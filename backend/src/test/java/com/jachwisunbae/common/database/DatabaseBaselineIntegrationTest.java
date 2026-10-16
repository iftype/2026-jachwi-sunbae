package com.jachwisunbae.common.database;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.common.config.LocalDatabaseSampleConfig;
import java.util.List;
import java.util.UUID;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.FlywayException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.core.io.ClassPathResource;
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
    void migratesAnEmptyDatabaseWithSystemItems() {
        flyway().migrate();

        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM system_check_items", Integer.class)).isEqualTo(14);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM rental_transactions", Integer.class)).isZero();
    }

    @Test
    void migratesAnEmptyDatabaseUpToBusStopCoordinateIndex() {
        flyway().migrate();

        assertThat(history()).containsExactly("1:SQL:1", "2:SQL:1");
        assertThat(busStopCoordinateIndexColumns()).containsExactly("latitude", "longitude");
    }

    @Test
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
        var membersBefore = jdbcTemplate.queryForList("SELECT * FROM members ORDER BY id");
        var checklistsBefore = jdbcTemplate.queryForList("SELECT * FROM user_checklists ORDER BY id");
        var systemItemsBefore = jdbcTemplate.queryForList("SELECT * FROM system_check_items ORDER BY id");
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .baselineVersion("1")
                .baselineOnMigrate(true)
                .load();

        assertThat(flyway.migrate().migrationsExecuted).isOne();
        assertThat(jdbcTemplate.queryForList("SELECT * FROM bus_stops ORDER BY id")).isEqualTo(busStopsBefore);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM members ORDER BY id")).isEqualTo(membersBefore);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM user_checklists ORDER BY id")).isEqualTo(checklistsBefore);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM system_check_items ORDER BY id")).isEqualTo(systemItemsBefore);
        assertThat(history()).containsExactly("1:BASELINE:1", "2:SQL:1");
        assertThat(busStopCoordinateIndexColumns()).containsExactly("latitude", "longitude");
    }

    // 성능 테스트 RDS처럼 Flyway 이력 없이 V2 인덱스를 수동으로 먼저 만든 DB
    @Test
    void manuallyIndexedDatabaseFailsOnVersion1BaselineAndJoinsOnVersion2Baseline() {
        new ResourceDatabasePopulator(
                new ClassPathResource("db/migration/V1__initial_schema.sql")).execute(dataSource);
        jdbcTemplate.execute("""
                ALTER TABLE bus_stops
                ADD INDEX idx_bus_stops_latitude_longitude (latitude, longitude), ALGORITHM=INPLACE, LOCK=NONE
                """);
        insertBusStop("existing", "기존 정류장");
        var busStopsBefore = jdbcTemplate.queryForList("SELECT * FROM bus_stops ORDER BY id");

        assertThatThrownBy(() -> baselineFlyway("1").migrate())
                .isInstanceOf(FlywayException.class)
                .hasMessageContaining("Duplicate key name 'idx_bus_stops_latitude_longitude'");
        // MySQL은 DDL을 롤백하지 못해 실패한 V2가 이력에 남는다. 다시 기동해도 검증에서 실패한다.
        assertThat(history()).containsExactly("1:BASELINE:1", "2:SQL:0");
        jdbcTemplate.execute("DROP TABLE flyway_schema_history");

        assertThat(baselineFlyway("2").migrate().migrationsExecuted).isZero();
        assertThat(history()).containsExactly("2:BASELINE:1");
        assertThat(busStopCoordinateIndexColumns()).containsExactly("latitude", "longitude");
        assertThat(jdbcTemplate.queryForList("SELECT * FROM bus_stops ORDER BY id")).isEqualTo(busStopsBefore);
        assertThat(flyway().migrate().migrationsExecuted).isZero();
    }

    @Test
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
