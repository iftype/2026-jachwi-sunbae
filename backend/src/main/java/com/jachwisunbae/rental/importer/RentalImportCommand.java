package com.jachwisunbae.rental.importer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jachwisunbae.rental.domain.RentalSnapshot;
import com.jachwisunbae.rental.repository.JdbcRentalTransactionRepository;
import com.jachwisunbae.rental.service.RentalImportService;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.Map;
import java.util.Set;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 명령행에서 CSV 검증과 보고서 생성을 실행하고 --apply 옵션이 있으면 DB에 적재한다.
 */
public class RentalImportCommand {
    private static final String DATASET_KEY = RentalSnapshot.DATASET_KEY;
    private static final Set<String> OPTIONS = Set.of(
        "transactions", "legal-dong-codes", "from", "to", "collected-at", "expected-rows", "report-dir", "apply"
    );

    public static void main(final String[] arguments) throws IOException {
        DefaultApplicationArguments args = new DefaultApplicationArguments(arguments);
        if (!OPTIONS.containsAll(args.getOptionNames()) || !args.getNonOptionArgs().isEmpty()
            || (args.containsOption("apply") && !args.getOptionValues("apply").isEmpty())) {
            throw new IllegalArgumentException("알 수 없는 옵션 또는 옵션 값입니다.");
        }
        Path transactionsPath = Path.of(required(args, "transactions"));
        Path codesPath = Path.of(required(args, "legal-dong-codes"));
        Path reportDir = Path.of(required(args, "report-dir"));
        RentalSnapshot snapshot = new RentalSnapshot(DATASET_KEY, sha256(transactionsPath), sha256(codesPath),
            LocalDate.parse(required(args, "from")), LocalDate.parse(required(args, "to")),
            OffsetDateTime.parse(required(args, "collected-at")).toInstant());
        RentalCsvReader.Result result = new RentalCsvReader().read(transactionsPath, LegalDongCatalog.load(codesPath));
        int expectedRows = Integer.parseInt(required(args, "expected-rows"));
        if (expectedRows <= 0 || result.totalRows() != expectedRows) {
            throw new IllegalArgumentException("거래 CSV의 건수가 예상 건수와 일치하지 않습니다.");
        }
        if (result.transactions().stream().anyMatch(transaction -> transaction.contractDate().isBefore(snapshot.datasetPeriodStart())
            || transaction.contractDate().isAfter(snapshot.datasetPeriodEnd()))) {
            throw new IllegalArgumentException("거래 계약일이 요청 기간을 벗어났습니다.");
        }
        Files.createDirectories(reportDir);
        writeUnmatched(reportDir, result.unmatched());
        String status = "VALIDATED";
        if (!result.unmatched().isEmpty()) {
            status = "UNMATCHED";
        } else if (args.containsOption("apply")) {
            DriverManagerDataSource dataSource = new DriverManagerDataSource(databaseUrl(),
                System.getenv().getOrDefault("DB_USERNAME", "jachwi_sunbae"),
                System.getenv().getOrDefault("DB_PASSWORD", "local_password"));
            new ResourceDatabasePopulator(new ClassPathResource("db/init/003-rental-schema.sql")).execute(dataSource);
            JdbcRentalTransactionRepository repository = new JdbcRentalTransactionRepository(new JdbcTemplate(dataSource));
            RentalImportService service = new RentalImportService(repository,
                new TransactionTemplate(new DataSourceTransactionManager(dataSource)));
            status = service.importSnapshot(snapshot, result.transactions()) ? "IMPORTED" : "UNCHANGED";
        }
        Map<String, Object> report = Map.of(
            "status", status, "datasetKey", DATASET_KEY, "inputRows", result.totalRows(),
            "mappedRows", result.transactions().size(), "unmatchedNames", result.unmatched().size(),
            "legalDongCount", result.transactions().stream().map(transaction -> transaction.legalDong().code()).distinct().count(),
            "transactionSha256", snapshot.transactionSha256(), "legalDongSha256", snapshot.legalDongSha256(),
            "collectedAt", snapshot.collectedAt().toString(),
            "contractPeriod", snapshot.datasetPeriodStart() + "~" + snapshot.datasetPeriodEnd()
        );
        String json = new ObjectMapper().writerWithDefaultPrettyPrinter().writeValueAsString(report);
        Files.writeString(reportDir.resolve("import-report.json"), json + "\n", StandardCharsets.UTF_8);
        System.out.println(json);
        if (!result.unmatched().isEmpty()) {
            throw new IllegalArgumentException("미매핑 법정동이 있어 적재하지 않았습니다. unmatched-legal-dongs.csv를 확인하세요.");
        }
    }

    private static String required(final DefaultApplicationArguments args, final String option) {
        var values = args.getOptionValues(option);
        if (values == null || values.size() != 1 || values.getFirst().isBlank()) {
            throw new IllegalArgumentException("필수 옵션 값이 필요합니다: --" + option);
        }
        return values.getFirst();
    }

    private static String databaseUrl() {
        return "jdbc:mysql://" + System.getenv().getOrDefault("DB_HOST", "127.0.0.1") + ":"
            + System.getenv().getOrDefault("DB_PORT", "3306") + "/"
            + System.getenv().getOrDefault("DB_NAME", "jachwi_sunbae")
            + "?allowPublicKeyRetrieval=true&useSSL=false&connectionTimeZone=%2B00:00"
            + "&forceConnectionTimeZoneToSession=true&preserveInstants=true&rewriteBatchedStatements=true";
    }

    private static String sha256(final Path path) throws IOException {
        try (InputStream input = Files.newInputStream(path)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[8192];
            int size;
            while ((size = input.read(buffer)) != -1) {
                digest.update(buffer, 0, size);
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256을 사용할 수 없습니다.", exception);
        }
    }

    private static void writeUnmatched(final Path reportDir, final Map<String, Integer> unmatched) throws IOException {
        try (CSVPrinter printer = CSVFormat.DEFAULT.builder().setHeader("legal_dong", "transaction_count")
            .get().print(reportDir.resolve("unmatched-legal-dongs.csv"), StandardCharsets.UTF_8)) {
            for (var entry : unmatched.entrySet()) {
                printer.printRecord(entry.getKey(), entry.getValue());
            }
        }
    }
}
