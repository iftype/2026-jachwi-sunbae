package com.jachwisunbae.rental.service;

import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.rental.repository.JdbcRentalTransactionRepository;
import com.jachwisunbae.rental.repository.query.RentalTransactionEntry;
import com.jachwisunbae.rental.service.dto.result.RentalTransactionPage;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

// 법정동의 최근 6개월 거래와 수집 정보를 페이지로 조회한다.
@Service
public class RentalTransactionQueryService {
    private static final ZoneId KOREA = ZoneId.of("Asia/Seoul");
    private final JdbcRentalTransactionRepository repository;
    private final Clock clock;

    public RentalTransactionQueryService(final JdbcRentalTransactionRepository repository, final Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public RentalTransactionPage findTransactions(final String legalDongCode, final int page, final int size) {
        validateQuery(legalDongCode, page, size);
        LocalDate queryEndDate = LocalDate.now(clock.withZone(KOREA));
        LocalDate queryStartDate = queryEndDate.minusMonths(6);
        long totalTransactionCount = repository.countByLegalDongCode(legalDongCode, queryStartDate, queryEndDate);
        List<RentalTransactionEntry> items = findTransactionEntries(
            legalDongCode, queryStartDate, queryEndDate, page, size, totalTransactionCount);
        return new RentalTransactionPage(legalDongCode, repository.findLegalDongName(legalDongCode).orElse(null),
            queryStartDate, queryEndDate, repository.findDatasetInfo().orElse(null), items, page, size, totalTransactionCount);
    }

    private void validateQuery(final String legalDongCode, final int page, final int size) {
        if (legalDongCode == null || !legalDongCode.matches("[0-9]{10}")
            || page < 0 || page > 10000 || size < 1 || size > 100) {
            throw new InvalidInputException(ErrorCode.RENTAL_QUERY_INVALID,
                "법정동 코드는 숫자 10자리, page는 0~10000, size는 1~100이어야 합니다.");
        }
    }

    private List<RentalTransactionEntry> findTransactionEntries(
        final String legalDongCode, final LocalDate queryStartDate, final LocalDate queryEndDate,
        final int page, final int size, final long totalTransactionCount
    ) {
        if (totalTransactionCount == 0) {
            return List.of();
        }
        return repository.findPageByLegalDongCode(legalDongCode, queryStartDate, queryEndDate, size, (long) page * size);
    }
}
