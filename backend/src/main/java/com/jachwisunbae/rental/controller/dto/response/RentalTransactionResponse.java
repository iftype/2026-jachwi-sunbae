package com.jachwisunbae.rental.controller.dto.response;

import com.jachwisunbae.rental.domain.AreaBasis;
import com.jachwisunbae.rental.domain.ContractType;
import com.jachwisunbae.rental.domain.HousingType;
import com.jachwisunbae.rental.repository.query.RentalTransactionEntry;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDate;

// 거래 한 건을 금액·면적·계약일·유형을 담은 API 응답으로 변환한다.
public record RentalTransactionResponse(
    @Schema(description = "수집본 교체 시 변경될 수 있는 거래 ID")
    long rentalTransactionId,
    @Schema(description = "ROWHOUSE: 연립·다세대, DETACHED: 단독·다가구, OFFICETEL: 오피스텔")
    HousingType housingType,
    long depositAmountKrw,
    @Schema(description = "원 단위 월세, 관리비 정보 미제공")
    long monthlyRentAmountKrw,
    @Schema(description = "제곱미터 면적")
    BigDecimal areaM2,
    @Schema(description = "EXCLUSIVE: 전용면적, CONTRACT: 단독·다가구 계약면적")
    AreaBasis areaBasis,
    LocalDate contractDate,
    @Schema(description = "NEW: 신규, RENEWAL: 갱신, UNKNOWN: 미상")
    ContractType contractType
) {
    public static RentalTransactionResponse from(final RentalTransactionEntry entry) {
        var transaction = entry.transaction();
        return new RentalTransactionResponse(entry.rentalTransactionId(), transaction.housingType(),
            transaction.price().depositAmountKrw(), transaction.price().monthlyRentAmountKrw(), transaction.area().areaM2(),
            transaction.area().areaBasis(), transaction.contractDate(), transaction.contractType());
    }
}
