package com.jachwisunbae.rental.repository;

import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.DataInconsistencyException;
import com.jachwisunbae.rental.domain.AreaBasis;
import com.jachwisunbae.rental.domain.ContractType;
import com.jachwisunbae.rental.domain.HousingType;
import com.jachwisunbae.rental.domain.LegalDong;
import com.jachwisunbae.rental.domain.RentalArea;
import com.jachwisunbae.rental.domain.RentalPrice;
import com.jachwisunbae.rental.domain.RentalSnapshot;
import com.jachwisunbae.rental.domain.RentalSource;
import com.jachwisunbae.rental.domain.RentalTransaction;
import com.jachwisunbae.rental.repository.query.RentalDatasetInfo;
import com.jachwisunbae.rental.repository.query.RentalTransactionEntry;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcRentalTransactionRepository {
    private final JdbcTemplate jdbcTemplate;

    public JdbcRentalTransactionRepository(final JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public boolean replaceSnapshot(final RentalSnapshot snapshot, final List<RentalTransaction> transactions) {
        jdbcTemplate.update("""
            INSERT INTO rental_datasets (dataset_key) VALUES (?)
            ON DUPLICATE KEY UPDATE dataset_key = dataset_key
            """, snapshot.datasetKey());
        Boolean unchanged = jdbcTemplate.queryForObject(
            "SELECT * FROM rental_datasets WHERE dataset_key = ? FOR UPDATE", (rs, index) -> {
                Timestamp collectedAt = rs.getTimestamp("collected_at");
                if (collectedAt != null && collectedAt.toInstant().isAfter(snapshot.collectedAt())) {
                    throw new IllegalArgumentException("이전 시점의 수집본으로 최신 거래를 교체할 수 없습니다.");
                }
                return Objects.equals(rs.getString("transaction_sha256"), snapshot.transactionSha256())
                    && Objects.equals(rs.getString("legal_dong_sha256"), snapshot.legalDongSha256())
                    && Objects.equals(rs.getDate("contract_from"), java.sql.Date.valueOf(snapshot.datasetPeriodStart()))
                    && Objects.equals(rs.getDate("contract_to"), java.sql.Date.valueOf(snapshot.datasetPeriodEnd()))
                    && Objects.equals(collectedAt, Timestamp.from(snapshot.collectedAt()));
            },
            snapshot.datasetKey());
        if (Boolean.TRUE.equals(unchanged)) {
            Long count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM rental_transactions WHERE dataset_key = ?", Long.class, snapshot.datasetKey());
            if (count == null || count != transactions.size()) {
                throw new IllegalStateException("동일 수집본의 DB 거래 건수가 일치하지 않습니다.");
            }
            return false;
        }
        Map<String, String> legalDongNamesByCode = transactions.stream().collect(Collectors.toMap(
            transaction -> transaction.legalDong().code(),
            transaction -> transaction.legalDong().name(), (first, second) -> first));
        jdbcTemplate.batchUpdate("""
            INSERT INTO legal_dongs (code, name) VALUES (?, ?)
            ON DUPLICATE KEY UPDATE name = VALUES(name)
            """, legalDongNamesByCode.entrySet(), 1000, (statement, entry) -> {
                statement.setString(1, entry.getKey());
                statement.setString(2, entry.getValue());
            });
        jdbcTemplate.update("DELETE FROM rental_transactions WHERE dataset_key = ?", snapshot.datasetKey());
        jdbcTemplate.batchUpdate("""
            INSERT INTO rental_transactions
                (dataset_key, legal_dong_code, housing_type, deposit_amount_krw, monthly_rent_amount_krw,
                 area_m2, area_basis, contract_date, contract_type, building_name, floor,
                 contract_period, source_file, source_row_number)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, transactions, 1000, (statement, transaction) -> {
                statement.setString(1, snapshot.datasetKey());
                statement.setString(2, transaction.legalDong().code());
                statement.setString(3, transaction.housingType().name());
                statement.setLong(4, transaction.price().depositAmountKrw());
                statement.setLong(5, transaction.price().monthlyRentAmountKrw());
                statement.setBigDecimal(6, transaction.area().areaM2());
                statement.setString(7, transaction.area().areaBasis().name());
                statement.setObject(8, transaction.contractDate());
                statement.setString(9, transaction.contractType().name());
                statement.setString(10, transaction.buildingName());
                statement.setString(11, transaction.floor());
                statement.setString(12, transaction.contractPeriod());
                statement.setString(13, transaction.source().sourceFile());
                statement.setLong(14, transaction.source().sourceRowNumber());
            });
        jdbcTemplate.update("""
            UPDATE rental_datasets SET transaction_sha256 = ?, legal_dong_sha256 = ?,
                contract_from = ?, contract_to = ?, collected_at = ?, imported_at = UTC_TIMESTAMP(6), row_count = ?
            WHERE dataset_key = ?
            """, snapshot.transactionSha256(), snapshot.legalDongSha256(), snapshot.datasetPeriodStart(),
            snapshot.datasetPeriodEnd(), Timestamp.from(snapshot.collectedAt()), transactions.size(), snapshot.datasetKey());
        return true;
    }

    public List<RentalTransaction> findByLegalDongCode(
        final String legalDongCode, final LocalDate queryStartDate, final LocalDate queryEndDate, final int limit
    ) {
        return findPageByLegalDongCode(legalDongCode, queryStartDate, queryEndDate, limit, 0).stream()
            .map(RentalTransactionEntry::transaction).toList();
    }

    public List<RentalTransactionEntry> findPageByLegalDongCode(
        final String legalDongCode, final LocalDate queryStartDate, final LocalDate queryEndDate,
        final int limit, final long offset
    ) {
        return jdbcTemplate.query("""
            SELECT t.*, d.name AS legal_dong_name FROM rental_transactions t
            JOIN legal_dongs d ON d.code = t.legal_dong_code
            WHERE t.dataset_key = ? AND t.legal_dong_code = ? AND t.contract_date BETWEEN ? AND ?
            ORDER BY t.contract_date DESC, t.id DESC LIMIT ? OFFSET ?
            """, (rs, index) -> new RentalTransactionEntry(rs.getLong("id"), restoreTransaction(rs)),
            RentalSnapshot.DATASET_KEY, legalDongCode, queryStartDate, queryEndDate, limit, offset);
    }

    public long countByLegalDongCode(
        final String legalDongCode, final LocalDate queryStartDate, final LocalDate queryEndDate
    ) {
        return Objects.requireNonNull(jdbcTemplate.queryForObject("""
            SELECT COUNT(*) FROM rental_transactions
            WHERE dataset_key = ? AND legal_dong_code = ? AND contract_date BETWEEN ? AND ?
            """, Long.class, RentalSnapshot.DATASET_KEY, legalDongCode, queryStartDate, queryEndDate));
    }

    public Optional<String> findLegalDongName(final String legalDongCode) {
        return jdbcTemplate.query("SELECT name FROM legal_dongs WHERE code = ?",
            (rs, index) -> rs.getString("name"), legalDongCode).stream().findFirst();
    }

    public Optional<RentalDatasetInfo> findDatasetInfo() {
        return jdbcTemplate.query("""
            SELECT contract_from, contract_to, collected_at FROM rental_datasets
            WHERE dataset_key = ? AND transaction_sha256 IS NOT NULL
            """, (rs, index) -> new RentalDatasetInfo(rs.getDate("contract_from").toLocalDate(),
                rs.getDate("contract_to").toLocalDate(), rs.getTimestamp("collected_at").toInstant()),
            RentalSnapshot.DATASET_KEY).stream().findFirst();
    }

    private RentalTransaction restoreTransaction(final ResultSet rs) throws SQLException {
        try {
            return new RentalTransaction(
                new LegalDong(rs.getString("legal_dong_code"), rs.getString("legal_dong_name")),
                HousingType.valueOf(rs.getString("housing_type")),
                new RentalPrice(rs.getLong("deposit_amount_krw"), rs.getLong("monthly_rent_amount_krw")),
                new RentalArea(rs.getBigDecimal("area_m2"), AreaBasis.valueOf(rs.getString("area_basis"))),
                rs.getDate("contract_date").toLocalDate(),
                ContractType.valueOf(rs.getString("contract_type")), rs.getString("building_name"), rs.getString("floor"),
                rs.getString("contract_period"), new RentalSource(rs.getString("source_file"), rs.getLong("source_row_number"))
            );
        } catch (IllegalArgumentException exception) {
            throw new DataInconsistencyException(ErrorCode.INTERNAL_SERVER_ERROR,
                "rentalTransactionId=" + rs.getLong("id") + " 저장된 거래가 임대 거래 규칙을 만족하지 않습니다.", exception);
        }
    }
}
