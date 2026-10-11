package com.jachwisunbae.rental.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.spy;

import com.jachwisunbae.rental.domain.AreaBasis;
import com.jachwisunbae.rental.domain.ContractType;
import com.jachwisunbae.rental.domain.HousingType;
import com.jachwisunbae.rental.domain.LegalDong;
import com.jachwisunbae.rental.domain.RentalArea;
import com.jachwisunbae.rental.domain.RentalPrice;
import com.jachwisunbae.rental.domain.RentalSnapshot;
import com.jachwisunbae.rental.domain.RentalSource;
import com.jachwisunbae.rental.domain.RentalTransaction;
import com.jachwisunbae.rental.repository.JdbcRentalTransactionRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.stream.LongStream;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class RentalImportServiceIntegrationTest {
    @Container
    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.10");
    private static final LocalDate FROM = LocalDate.parse("2026-04-09");
    private static final LocalDate TO = LocalDate.parse("2026-10-09");
    private static JdbcTemplate jdbc;
    private static JdbcRentalTransactionRepository repository;
    private static RentalImportService service;

    @BeforeAll
    static void setUp() {
        DataSource source = new DriverManagerDataSource(MYSQL.getJdbcUrl()
            + "?connectionTimeZone=%2B00:00&forceConnectionTimeZoneToSession=true&preserveInstants=true",
            MYSQL.getUsername(), MYSQL.getPassword());
        new ResourceDatabasePopulator(new ClassPathResource("db/init/003-rental-schema.sql")).execute(source);
        jdbc = new JdbcTemplate(source);
        repository = new JdbcRentalTransactionRepository(jdbc);
        service = new RentalImportService(repository, new TransactionTemplate(new DataSourceTransactionManager(source)));
    }

    @BeforeEach
    void clearSnapshots() {
        jdbc.update("DELETE FROM rental_transactions");
        jdbc.update("DELETE FROM rental_datasets");
        jdbc.update("DELETE FROM legal_dongs");
    }

    @Test
    void repeatedSnapshotIsUnchangedAndPreservesIdenticalContracts() {
        List<RentalTransaction> rows = List.of(transaction(1), transaction(2));
        service.importSnapshot(snapshot("a"), rows);

        boolean changed = service.importSnapshot(snapshot("a"), rows);

        assertThat(changed).isFalse();
        assertThat(count()).isEqualTo(2);
        assertThat(repository.findByLegalDongCode("1162010200", FROM, TO, 20)).containsExactly(transaction(2), transaction(1));
        assertThat(repository.findByLegalDongCode("1111010100", FROM, TO, 20)).isEmpty();
        assertThat(repository.findByLegalDongCode("1162010200", FROM, TO.minusDays(2), 20)).isEmpty();
    }

    @Test
    void changedSnapshotReplacesPreviousRows() {
        service.importSnapshot(snapshot("a"), List.of(transaction(1), transaction(2)));

        boolean changed = service.importSnapshot(snapshot("b"), List.of(transaction(3)));

        assertThat(changed).isTrue();
        assertThat(count()).isOne();
        assertThat(repository.findByLegalDongCode("1162010200", FROM, TO, 20))
            .extracting(transaction -> transaction.source().sourceRowNumber()).containsExactly(3L);
    }

    @Test
    void changedCollectionTimeReplacesSnapshotEvenWhenHashesAreIdentical() {
        service.importSnapshot(snapshot("a"), List.of(transaction(1)));
        RentalSnapshot latest = new RentalSnapshot("seoul-eastern-gyeonggi", "a".repeat(64), "c".repeat(64),
            FROM, TO, Instant.parse("2026-10-09T13:37:25Z"));

        boolean changed = service.importSnapshot(latest, List.of(transaction(2)));

        assertThat(changed).isTrue();
        assertThat(repository.findDatasetInfo().orElseThrow().collectedAt()).isEqualTo(latest.collectedAt());
        assertThat(repository.findByLegalDongCode("1162010200", FROM, TO, 20)).containsExactly(transaction(2));
    }

    @Test
    void rejectsRepeatedSnapshotWhenStoredTransactionCountIsDifferent() {
        List<RentalTransaction> transactions = List.of(transaction(1), transaction(2));
        service.importSnapshot(snapshot("a"), transactions);
        jdbc.update("DELETE FROM rental_transactions WHERE source_row_number = ?", 2);

        assertThatThrownBy(() -> service.importSnapshot(snapshot("a"), transactions))
            .isInstanceOf(IllegalStateException.class).hasMessage("동일 수집본의 DB 거래 건수가 일치하지 않습니다.");

        assertThat(repository.findByLegalDongCode("1162010200", FROM, TO, 20)).containsExactly(transaction(1));
    }

    @ParameterizedTest
    @EnumSource(ContractType.class)
    void preservesContractTypeWhenSavingAndRestoringTransactions(final ContractType contractType) {
        RentalTransaction transaction = transaction(1, contractType);

        service.importSnapshot(snapshot("a"), List.of(transaction));

        assertThat(repository.findByLegalDongCode("1162010200", FROM, TO, 20)).containsExactly(transaction);
    }

    @ParameterizedTest
    @CsvSource({"ROWHOUSE,EXCLUSIVE", "DETACHED,CONTRACT", "OFFICETEL,EXCLUSIVE"})
    void preservesHousingTypeAndAreaBasisWhenSavingAndRestoringTransactions(
        final HousingType housingType, final AreaBasis areaBasis
    ) {
        RentalTransaction transaction = new RentalTransaction(
            new LegalDong("1162010200", "서울특별시 관악구 신림동"), housingType,
            new RentalPrice(5000000, 450000), new RentalArea(new BigDecimal("20.1234"), areaBasis), TO.minusDays(1),
            ContractType.NEW, "신림빌라", "3", "202610~202810", new RentalSource("raw/source.csv", 1));

        service.importSnapshot(snapshot("a"), List.of(transaction));

        assertThat(repository.findByLegalDongCode("1162010200", FROM, TO, 20)).containsExactly(transaction);
    }

    @Test
    void failedReplacementRollsBackDeletedRowsAndMetadata() {
        service.importSnapshot(snapshot("a"), List.of(transaction(1)));

        assertThatThrownBy(() -> service.importSnapshot(snapshot("b"), List.of(transaction(2), transaction(2))))
            .isInstanceOf(DuplicateKeyException.class);

        assertThat(count()).isOne();
        assertThat(jdbc.queryForObject("SELECT transaction_sha256 FROM rental_datasets", String.class))
            .isEqualTo("a".repeat(64));
        assertThat(repository.findByLegalDongCode("1162010200", FROM, TO, 20))
            .extracting(transaction -> transaction.source().sourceRowNumber()).containsExactly(1L);
    }

    @Test
    void failedLaterBatchRollsBackTransactionsLegalDongsAndMetadata() {
        service.importSnapshot(snapshot("a"), List.of(transaction(9999)));
        var previousTransactions = jdbc.queryForList("SELECT * FROM rental_transactions ORDER BY id");
        var previousLegalDongs = jdbc.queryForList("SELECT * FROM legal_dongs ORDER BY code");
        var previousDataset = jdbc.queryForMap("SELECT * FROM rental_datasets");
        LegalDong renamedDong = new LegalDong("1162010200", "서울특별시 관악구 신림동 수정");
        LegalDong addedDong = new LegalDong("1111010100", "서울특별시 종로구 청운동");
        List<RentalTransaction> transactions = new ArrayList<>(LongStream.rangeClosed(1, 1000)
            .mapToObj(sourceRow -> transaction(sourceRow, ContractType.NEW, renamedDong)).toList());
        RentalTransaction duplicatedTransaction = transaction(1001, ContractType.NEW, addedDong);
        transactions.add(duplicatedTransaction);
        transactions.add(duplicatedTransaction);

        assertThatThrownBy(() -> service.importSnapshot(snapshot("b"), transactions))
            .isInstanceOf(DuplicateKeyException.class);

        assertThat(jdbc.queryForList("SELECT * FROM rental_transactions ORDER BY id"))
            .isEqualTo(previousTransactions);
        assertThat(jdbc.queryForList("SELECT * FROM legal_dongs ORDER BY code")).isEqualTo(previousLegalDongs);
        assertThat(jdbc.queryForMap("SELECT * FROM rental_datasets")).isEqualTo(previousDataset);
    }

    @Test
    void failureAfterMetadataUpdateRollsBackEntireReplacement() {
        service.importSnapshot(snapshot("a"), List.of(transaction(1)));
        var previousTransactions = jdbc.queryForList("SELECT * FROM rental_transactions ORDER BY id");
        var previousDataset = jdbc.queryForMap("SELECT * FROM rental_datasets");
        JdbcRentalTransactionRepository failingRepository = spy(repository);
        doAnswer(invocation -> {
            invocation.callRealMethod();
            assertThat(jdbc.queryForObject("SELECT transaction_sha256 FROM rental_datasets", String.class))
                .isEqualTo("b".repeat(64));
            assertThat(repository.findByLegalDongCode("1162010200", FROM, TO, 20)).containsExactly(transaction(2));
            throw new IllegalStateException("수집본 갱신 후 강제 실패");
        }).when(failingRepository).updateSnapshot(any(RentalSnapshot.class), anyInt());
        RentalImportService failingService = new RentalImportService(failingRepository,
            new TransactionTemplate(new DataSourceTransactionManager(jdbc.getDataSource())));

        assertThatThrownBy(() -> failingService.importSnapshot(snapshot("b"), List.of(transaction(2))))
            .isInstanceOf(IllegalStateException.class).hasMessage("수집본 갱신 후 강제 실패");

        assertThat(jdbc.queryForList("SELECT * FROM rental_transactions ORDER BY id"))
            .isEqualTo(previousTransactions);
        assertThat(jdbc.queryForMap("SELECT * FROM rental_datasets")).isEqualTo(previousDataset);
    }

    @Test
    void failedFirstImportRollsBackDatasetAndLegalDongs() {
        assertThatThrownBy(() -> service.importSnapshot(snapshot("a"), List.of(transaction(1), transaction(1))))
            .isInstanceOf(DuplicateKeyException.class);

        assertThat(count()).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM rental_datasets", Long.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM legal_dongs", Long.class)).isZero();
    }

    @Test
    void rejectsEmptyReplacement() {
        service.importSnapshot(snapshot("a"), List.of(transaction(1)));

        assertThatThrownBy(() -> service.importSnapshot(snapshot("b"), List.of()))
            .isInstanceOf(IllegalArgumentException.class);

        assertThat(count()).isOne();
    }

    @Test
    void rejectsOlderSnapshotBeforeReplacingLatestData() {
        service.importSnapshot(snapshot("a"), List.of(transaction(1)));
        RentalSnapshot older = new RentalSnapshot("seoul-eastern-gyeonggi", "b".repeat(64), "c".repeat(64),
            FROM, TO, Instant.parse("2026-10-09T11:37:25Z"));

        assertThatThrownBy(() -> service.importSnapshot(older, List.of(transaction(2))))
            .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("이전 시점");

        assertThat(count()).isOne();
        assertThat(jdbc.queryForObject("SELECT transaction_sha256 FROM rental_datasets", String.class))
            .isEqualTo("a".repeat(64));
    }

    @Test
    void concurrentSameSnapshotOnlyImportsOnce() throws Exception {
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> {
                start.await();
                return service.importSnapshot(snapshot("a"), List.of(transaction(1)));
            });
            var second = executor.submit(() -> {
                start.await();
                return service.importSnapshot(snapshot("a"), List.of(transaction(1)));
            });

            start.countDown();

            assertThat(List.of(first.get(), second.get())).containsExactlyInAnyOrder(true, false);
            assertThat(count()).isOne();
        }
    }

    private long count() {
        return jdbc.queryForObject("SELECT COUNT(*) FROM rental_transactions", Long.class);
    }

    private RentalSnapshot snapshot(final String hash) {
        return new RentalSnapshot("seoul-eastern-gyeonggi", hash.repeat(64), "c".repeat(64),
            FROM, TO, Instant.parse("2026-10-09T12:37:25Z"));
    }

    private RentalTransaction transaction(final long sourceRow) {
        return transaction(sourceRow, ContractType.NEW);
    }

    private RentalTransaction transaction(final long sourceRow, final ContractType contractType) {
        return transaction(sourceRow, contractType, new LegalDong("1162010200", "서울특별시 관악구 신림동"));
    }

    private RentalTransaction transaction(
        final long sourceRow, final ContractType contractType, final LegalDong legalDong
    ) {
        return new RentalTransaction(legalDong, HousingType.ROWHOUSE,
            new RentalPrice(5000000, 450000), new RentalArea(new BigDecimal("20.1234"), AreaBasis.EXCLUSIVE), TO.minusDays(1),
            contractType, "신림빌라", "3", "202610~202810", new RentalSource("raw/source.csv", sourceRow));
    }
}
