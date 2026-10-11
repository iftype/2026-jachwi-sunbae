package com.jachwisunbae.rental.controller.dto.response;

import com.jachwisunbae.rental.domain.AreaBasis;
import com.jachwisunbae.rental.domain.ContractType;
import com.jachwisunbae.rental.domain.HousingType;
import com.jachwisunbae.rental.repository.query.RentalTransactionEntry;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 거래 한 건을 원본 추적 정보 없이 금액·면적·계약일·유형을 담은 API 응답으로 변환한다.
 */
@Schema(description = "원룸 여부를 확인할 수 없는 소형 주택 월세 거래 참고 사례")
public record RentalTransactionResponse(
    @Schema(description = "거래 식별자. 수집본 교체 시 변경될 수 있음") long rentalTransactionId,
    HousingType housingType,
    @Schema(description = "보증금, 원 단위", example = "5000000") long depositAmountKrw,
    @Schema(description = "월세, 원 단위. 관리비 정보는 제공되지 않음", example = "450000") long monthlyRentAmountKrw,
    @Schema(description = "면적, 제곱미터 단위", example = "20.5000") BigDecimal areaM2,
    @Schema(description = "EXCLUSIVE: 전용면적, CONTRACT: 단독·다가구 계약면적") AreaBasis areaBasis,
    LocalDate contractDate,
    @Schema(description = "NEW: 신규, RENEWAL: 갱신, UNKNOWN: 미상") ContractType contractType
) {
    public static RentalTransactionResponse from(final RentalTransactionEntry entry) {
        var transaction = entry.transaction();
        return new RentalTransactionResponse(entry.rentalTransactionId(), transaction.housingType(),
            transaction.price().depositAmountKrw(), transaction.price().monthlyRentAmountKrw(), transaction.area().areaM2(),
            transaction.area().areaBasis(), transaction.contractDate(), transaction.contractType());
    }
}
