package com.jachwisunbae.rental.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@Tag("acceptance")
class RentalImportAcceptanceTest {
    @Container
    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.10")
        .withDatabaseName("rental_import").withUsername("rental_app").withPassword("import_test_password");
    private static JdbcTemplate databaseAdmin;
    private JdbcTemplate admin;
    private String databaseName;
    private String jdbcUrl;
    @TempDir
    private Path work;

    @BeforeAll
    static void configureDataOnlyAccount() {
        databaseAdmin = new JdbcTemplate(new DriverManagerDataSource(MYSQL.getJdbcUrl(), "root", MYSQL.getPassword()));
        databaseAdmin.execute("REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'rental_app'@'%'");
    }

    @BeforeEach
    void prepareSchemaAndFiles() throws Exception {
        databaseName = "rental_import_" + UUID.randomUUID().toString().replace("-", "");
        databaseAdmin.execute("CREATE DATABASE `" + databaseName + "`");
        databaseAdmin.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON `" + databaseName + "`.* TO 'rental_app'@'%'");
        jdbcUrl = "jdbc:mysql://" + MYSQL.getHost() + ":" + MYSQL.getMappedPort(3306) + "/" + databaseName;
        var adminSource = new DriverManagerDataSource(jdbcUrl, "root", MYSQL.getPassword());
        admin = new JdbcTemplate(adminSource);
        Flyway.configure().dataSource(adminSource).cleanDisabled(true).load().migrate();
        Files.writeString(work.resolve("법정동 코드.txt"),
            "법정동코드\t법정동명\t폐지여부\n1162010200\t서울특별시 관악구 신림동\t존재\n",
            Charset.forName("MS949"));
        writeTransactions(45);
    }

    @Test
    void importsReplacesAndSkipsRepeatedDataWithoutCreatePrivilege() throws Exception {
        var grants = new JdbcTemplate(new DriverManagerDataSource(
            jdbcUrl, MYSQL.getUsername(), MYSQL.getPassword())).queryForList("SHOW GRANTS", String.class);
        assertThat(grants).noneMatch(grant -> grant.contains("CREATE") || grant.contains("ALL PRIVILEGES"));

        assertThat(runImport(true)).isZero();
        assertThat(reportStatus()).isEqualTo("IMPORTED");
        assertThat(admin.queryForObject("SELECT monthly_rent_amount_krw FROM rental_transactions", Long.class))
            .isEqualTo(450000L);

        writeTransactions(50);
        assertThat(runImport(true)).isZero();
        assertThat(reportStatus()).isEqualTo("IMPORTED");
        assertThat(admin.queryForObject("SELECT COUNT(*) FROM rental_transactions", Long.class)).isEqualTo(1L);
        assertThat(admin.queryForObject("SELECT monthly_rent_amount_krw FROM rental_transactions", Long.class))
            .isEqualTo(500000L);

        assertThat(runImport(true)).isZero();
        assertThat(reportStatus()).isEqualTo("UNCHANGED");
        assertThat(output()).doesNotContain("Tomcat started");
    }

    @Test
    void missingTableFailsBeforeChangingExistingSnapshot() throws Exception {
        assertThat(runImport(true)).isZero();
        String snapshotHash = snapshotHash();
        admin.execute("DROP TABLE rental_transactions");
        writeTransactions(50);

        assertThat(runImport(true)).isNotZero();
        assertThat(output()).contains("월세 적재용 InnoDB 테이블이 준비되지 않았습니다");
        assertThat(snapshotHash()).isEqualTo(snapshotHash);
        assertThat(admin.queryForObject("""
            SELECT COUNT(*) FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rental_transactions'
            """, Long.class)).isZero();
    }

    @Test
    void missingColumnFailsBeforeDeletingExistingTransactions() throws Exception {
        assertThat(runImport(true)).isZero();
        String snapshotHash = snapshotHash();
        admin.execute("ALTER TABLE rental_transactions DROP COLUMN floor");
        writeTransactions(50);

        assertThat(runImport(true)).isNotZero();
        assertThat(output()).contains("필수 컬럼과 SELECT 권한을 확인해 주세요: rental_transactions");
        assertThat(snapshotHash()).isEqualTo(snapshotHash);
        assertThat(admin.queryForObject("SELECT monthly_rent_amount_krw FROM rental_transactions", Long.class))
            .isEqualTo(450000L);
    }

    @Test
    void nonTransactionalTableFailsBeforeReplacingData() throws Exception {
        assertThat(runImport(true)).isZero();
        String snapshotHash = snapshotHash();
        admin.execute("ALTER TABLE rental_transactions DROP FOREIGN KEY fk_rental_legal_dong");
        admin.execute("ALTER TABLE legal_dongs ENGINE = MyISAM");
        writeTransactions(50);

        assertThat(runImport(true)).isNotZero();
        assertThat(output()).contains("월세 적재용 InnoDB 테이블이 준비되지 않았습니다");
        assertThat(snapshotHash()).isEqualTo(snapshotHash);
        assertThat(admin.queryForObject("SELECT monthly_rent_amount_krw FROM rental_transactions", Long.class))
            .isEqualTo(450000L);
    }

    @Test
    void validationModeWorksWithoutDatabaseConnectionOrSchema() throws Exception {
        admin.execute("DROP TABLE rental_transactions");
        admin.execute("DROP TABLE rental_datasets");
        admin.execute("DROP TABLE legal_dongs");

        assertThat(runImport(false)).isZero();
        assertThat(reportStatus()).isEqualTo("VALIDATED");
        assertThat(admin.queryForObject("""
            SELECT COUNT(*) FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME IN ('legal_dongs', 'rental_datasets', 'rental_transactions')
            """, Long.class)).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"--unknown=true", "--apply=true", "unexpected"})
    void rejectsInvalidOptionsBeforeWritingReports(final String option) throws Exception {
        assertThat(runImport(false, option)).isNotZero();
        assertThat(output()).contains("알 수 없는 옵션 또는 옵션 값입니다");
        assertThat(work.resolve("report")).doesNotExist();
    }

    @Test
    void rejectsUnexpectedRowCountBeforeWritingReports() throws Exception {
        Path csvPath = work.resolve("거래 자료.csv");
        String csv = Files.readString(csvPath);
        String additionalRow = csv.lines().skip(1).findFirst().orElseThrow()
            .replace("source.csv,1", "source.csv,2");
        Files.writeString(csvPath, csv + additionalRow + "\n");

        assertThat(runImport(true)).isNotZero();
        assertThat(output()).contains("거래 CSV의 건수가 예상 건수와 일치하지 않습니다");
        assertThat(work.resolve("report")).doesNotExist();
        assertThat(admin.queryForObject("SELECT COUNT(*) FROM rental_datasets", Long.class)).isZero();
    }

    @Test
    void rejectsContractDateOutsideRequestedPeriodBeforeWritingReports() throws Exception {
        Path csvPath = work.resolve("거래 자료.csv");
        Files.writeString(csvPath, Files.readString(csvPath).replace("2026-10-09", "2026-04-08"));

        assertThat(runImport(true)).isNotZero();
        assertThat(output()).contains("거래 계약일이 요청 기간을 벗어났습니다");
        assertThat(work.resolve("report")).doesNotExist();
        assertThat(admin.queryForObject("SELECT COUNT(*) FROM rental_datasets", Long.class)).isZero();
    }

    @Test
    void rejectsAreaBasisThatDoesNotMatchHousingTypeBeforeImport() throws Exception {
        Path csvPath = work.resolve("거래 자료.csv");
        Files.writeString(csvPath, Files.readString(csvPath).replace(",exclusive,", ",contract,"));

        assertThat(runImport(true)).isNotZero();
        assertThat(output()).contains("주택 유형과 면적 기준이 일치하지 않습니다");
        assertThat(admin.queryForObject("SELECT COUNT(*) FROM rental_datasets", Long.class)).isZero();
    }

    @Test
    void writesUnmatchedReportsAndRejectsImportWithoutChangingDatabase() throws Exception {
        Path csvPath = work.resolve("거래 자료.csv");
        Files.writeString(csvPath, Files.readString(csvPath).replace("관악구 신림동", "관악구 미등록동"));

        assertThat(runImport(true)).isNotZero();
        assertThat(reportStatus()).isEqualTo("UNMATCHED");
        assertThat(Files.readString(work.resolve("report/unmatched-legal-dongs.csv")))
            .contains("서울특별시 관악구 미등록동,1");
        assertThat(output()).contains("미매핑 법정동이 있어 적재하지 않았습니다");
        assertThat(admin.queryForObject("SELECT COUNT(*) FROM rental_datasets", Long.class)).isZero();
        assertThat(admin.queryForObject("SELECT COUNT(*) FROM rental_transactions", Long.class)).isZero();
    }

    private int runImport(final boolean apply, final String... additionalOptions) throws Exception {
        List<String> command = new ArrayList<>(List.of(
            Path.of(System.getProperty("java.home"), "bin", "java").toString(),
            "-Dloader.main=com.jachwisunbae.rental.importer.RentalImportCommand",
            "-cp", System.getProperty("rental.import.jar"),
            "org.springframework.boot.loader.launch.PropertiesLauncher",
            "--transactions=" + work.resolve("거래 자료.csv"),
            "--legal-dong-codes=" + work.resolve("법정동 코드.txt"),
            "--from=2026-04-09", "--to=2026-10-09", "--collected-at=2026-10-09T21:37:25+09:00",
            "--expected-rows=1", "--report-dir=" + work.resolve("report")
        ));
        if (apply) {
            command.add("--apply");
        }
        command.addAll(List.of(additionalOptions));
        ProcessBuilder builder = new ProcessBuilder(command).redirectErrorStream(true)
            .redirectOutput(work.resolve("command.log").toFile());
        builder.environment().put("DB_HOST", apply ? MYSQL.getHost() : "unreachable.invalid");
        builder.environment().put("DB_PORT", MYSQL.getMappedPort(3306).toString());
        builder.environment().put("DB_NAME", databaseName);
        builder.environment().put("DB_USERNAME", MYSQL.getUsername());
        builder.environment().put("DB_PASSWORD", MYSQL.getPassword());
        Process process = builder.start();
        boolean finished = process.waitFor(45, TimeUnit.SECONDS);
        if (!finished) {
            process.destroyForcibly();
        }
        assertThat(finished).as("적재 명령의 종료 제한: %s", output()).isTrue();
        return process.exitValue();
    }

    private void writeTransactions(final int monthlyRent) throws Exception {
        Files.writeString(work.resolve("거래 자료.csv"), """
            legal_dong,housing_type,deposit_10k_krw,monthly_rent_10k_krw,area_m2,area_basis,contract_date,contract_type,building_name,floor,contract_period,source_file,source_row_number
            서울특별시 관악구 신림동,연립다세대,500,%d,20.0000,exclusive,2026-10-09,신규,신림빌라,3,,source.csv,1
            """.formatted(monthlyRent));
    }

    private String reportStatus() throws Exception {
        return new ObjectMapper().readTree(work.resolve("report/import-report.json").toFile()).path("status").asText();
    }

    private String snapshotHash() {
        return admin.queryForObject("SELECT transaction_sha256 FROM rental_datasets", String.class);
    }

    private String output() throws Exception {
        return Files.readString(work.resolve("command.log"));
    }
}
