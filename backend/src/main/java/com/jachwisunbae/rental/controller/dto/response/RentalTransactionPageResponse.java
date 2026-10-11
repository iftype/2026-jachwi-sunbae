package com.jachwisunbae.rental.controller.dto.response;

import com.jachwisunbae.rental.service.dto.result.RentalTransactionPage;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

// 거래 페이지를 법정동·기간·참고 정보 표시명을 포함한 API 응답으로 변환한다.
public record RentalTransactionPageResponse(
    String legalDongCode,
    @Schema(description = "집계 법정동 전체 이름. 보관된 법정동 정보가 없으면 null", nullable = true) String legalDongName,
    @Schema(example = "소형 주택 월세 참고 정보") String referenceLabel,
    @Schema(description = "한국 날짜 기준 최근 6개월 조회 시작일, 포함") LocalDate queryStartDate,
    @Schema(description = "한국 날짜 기준 조회 마지막 날짜, 포함") LocalDate queryEndDate,
    @Schema(description = "수집본에 포함하도록 지정한 계약일 범위의 시작일, 포함. 아직 적재되지 않았으면 null", nullable = true) LocalDate datasetPeriodStart,
    @Schema(description = "수집본에 포함하도록 지정한 계약일 범위의 종료일, 포함. 최근 신고가 덜 반영될 수 있음", nullable = true) LocalDate datasetPeriodEnd,
    @Schema(description = "원본 수집 시점, UTC. 아직 적재되지 않았으면 null", nullable = true) Instant collectedAt,
    List<RentalTransactionResponse> items,
    int page,
    int size,
    long totalCount,
    boolean hasNext
) {
    public static RentalTransactionPageResponse from(final RentalTransactionPage result) {
        var dataset = result.datasetInfo();
        return new RentalTransactionPageResponse(result.legalDongCode(), result.legalDongName(),
            "소형 주택 월세 참고 정보", result.queryStartDate(), result.queryEndDate(),
            dataset == null ? null : dataset.datasetPeriodStart(), dataset == null ? null : dataset.datasetPeriodEnd(),
            dataset == null ? null : dataset.collectedAt(),
            result.items().stream().map(RentalTransactionResponse::from).toList(),
            result.page(), result.size(), result.totalCount(), result.hasNext());
    }
}
