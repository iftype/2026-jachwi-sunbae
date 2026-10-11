package com.jachwisunbae.rental.service;

import com.jachwisunbae.rental.domain.RentalSnapshot;
import com.jachwisunbae.rental.domain.RentalTransaction;
import com.jachwisunbae.rental.repository.JdbcRentalTransactionRepository;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 수집본 입력을 검증하고 전체 교체를 하나의 트랜잭션으로 실행한다.
 */
public class RentalImportService {
    private final JdbcRentalTransactionRepository repository;
    private final TransactionTemplate transactionTemplate;

    public RentalImportService(
        final JdbcRentalTransactionRepository repository, final TransactionTemplate transactionTemplate
    ) {
        this.repository = repository;
        this.transactionTemplate = transactionTemplate;
    }

    public boolean importSnapshot(final RentalSnapshot snapshot, final List<RentalTransaction> transactions) {
        validateNotEmpty(transactions);
        validateContractDateRange(snapshot, transactions);
        return Objects.requireNonNull(transactionTemplate.execute(
            status -> replaceSnapshot(snapshot, transactions)));
    }

    private boolean replaceSnapshot(final RentalSnapshot snapshot, final List<RentalTransaction> transactions) {
        repository.createDatasetIfAbsent(snapshot.datasetKey());
        Optional<RentalSnapshot> previousSnapshot = repository.findSnapshotForUpdate(snapshot.datasetKey());
        previousSnapshot.ifPresent(previous -> validateCollectionTime(snapshot, previous));
        if (previousSnapshot.filter(snapshot::equals).isPresent()) {
            validateTransactionCount(snapshot.datasetKey(), transactions.size());
            return false;
        }
        repository.upsertLegalDongs(transactions.stream().map(RentalTransaction::legalDong).toList());
        repository.deleteByDatasetKey(snapshot.datasetKey());
        repository.saveAll(snapshot.datasetKey(), transactions);
        repository.updateSnapshot(snapshot, transactions.size());
        return true;
    }

    private void validateCollectionTime(final RentalSnapshot snapshot, final RentalSnapshot previousSnapshot) {
        if (previousSnapshot.collectedAt().isAfter(snapshot.collectedAt())) {
            throw new IllegalArgumentException("이전 시점의 수집본으로 최신 거래를 교체할 수 없습니다.");
        }
    }

    private void validateTransactionCount(final String datasetKey, final int expectedCount) {
        if (repository.countByDatasetKey(datasetKey) != expectedCount) {
            throw new IllegalStateException("동일 수집본의 DB 거래 건수가 일치하지 않습니다.");
        }
    }

    private void validateNotEmpty(final List<RentalTransaction> transactions) {
        if (transactions.isEmpty()) {
            throw new IllegalArgumentException("빈 수집본으로 기존 거래를 교체할 수 없습니다.");
        }
    }

    private void validateContractDateRange(final RentalSnapshot snapshot, final List<RentalTransaction> transactions) {
        if (transactions.stream().anyMatch(transaction -> transaction.contractDate().isBefore(snapshot.datasetPeriodStart())
            || transaction.contractDate().isAfter(snapshot.datasetPeriodEnd()))) {
            throw new IllegalArgumentException("거래 계약일이 수집본 기간을 벗어났습니다.");
        }
    }
}
