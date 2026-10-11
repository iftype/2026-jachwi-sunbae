package com.jachwisunbae.rental.service;

import com.jachwisunbae.rental.domain.RentalSnapshot;
import com.jachwisunbae.rental.domain.RentalTransaction;
import com.jachwisunbae.rental.repository.JdbcRentalTransactionRepository;
import java.util.List;
import java.util.Objects;
import org.springframework.transaction.support.TransactionTemplate;

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
        if (transactions.isEmpty()) {
            throw new IllegalArgumentException("빈 수집본으로 기존 거래를 교체할 수 없습니다.");
        }
        if (transactions.stream().anyMatch(transaction -> transaction.contractDate().isBefore(snapshot.datasetPeriodStart())
            || transaction.contractDate().isAfter(snapshot.datasetPeriodEnd()))) {
            throw new IllegalArgumentException("거래 계약일이 수집본 기간을 벗어났습니다.");
        }
        return Objects.requireNonNull(transactionTemplate.execute(
            status -> repository.replaceSnapshot(snapshot, transactions)));
    }
}
