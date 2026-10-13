package com.jachwisunbae.rental.service.dto.result;

import com.jachwisunbae.rental.repository.query.RentalDatasetInfo;
import com.jachwisunbae.rental.repository.query.RentalTransactionEntry;
import java.time.LocalDate;
import java.util.List;

// 거래 조회 결과와 기간·수집 정보를 전달하고 다음 페이지 여부를 계산한다.
public record RentalTransactionPage(
    String legalDongCode,
    String legalDongName,
    LocalDate queryStartDate,
    LocalDate queryEndDate,
    RentalDatasetInfo datasetInfo,
    List<RentalTransactionEntry> items,
    int page,
    int size,
    long totalCount
) {
    public RentalTransactionPage {
        items = List.copyOf(items);
    }

    public boolean hasNext() {
        return (page + 1L) * size < totalCount;
    }
}
