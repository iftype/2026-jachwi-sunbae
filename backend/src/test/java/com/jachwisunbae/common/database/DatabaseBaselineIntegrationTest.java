package com.jachwisunbae.common.database;

import static org.assertj.core.api.Assertions.assertThat;

import com.jachwisunbae.common.config.LocalDatabaseSampleConfig;
import java.util.UUID;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
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
        var membersBefore = jdbcTemplate.queryForList("SELECT * FROM members ORDER BY id");
        var checklistsBefore = jdbcTemplate.queryForList("SELECT * FROM user_checklists ORDER BY id");
        var systemItemsBefore = jdbcTemplate.queryForList("SELECT * FROM system_check_items ORDER BY id");
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .baselineVersion("1")
                .baselineOnMigrate(true)
                .load();

        assertThat(flyway.migrate().migrationsExecuted).isZero();
        assertThat(jdbcTemplate.queryForList("SELECT * FROM members ORDER BY id")).isEqualTo(membersBefore);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM user_checklists ORDER BY id")).isEqualTo(checklistsBefore);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM system_check_items ORDER BY id")).isEqualTo(systemItemsBefore);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT type FROM flyway_schema_history WHERE version = '1'", String.class)).isEqualTo("BASELINE");
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
