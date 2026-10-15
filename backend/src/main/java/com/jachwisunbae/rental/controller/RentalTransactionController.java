package com.jachwisunbae.rental.controller;

import com.jachwisunbae.common.web.ApiResponse;
import com.jachwisunbae.rental.controller.dto.response.RentalTransactionPageResponse;
import com.jachwisunbae.rental.service.RentalTransactionQueryService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/rental-transactions")
public class RentalTransactionController {
    private final RentalTransactionQueryService service;

    public RentalTransactionController(final RentalTransactionQueryService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "법정동별 최근 월세 거래 조회",
        description = "최근 6개월의 5~10평 실거래 참고 정보입니다. 원룸 여부와 현재 매물 여부는 확인되지 않습니다. "
            + "계약일·거래 ID 내림차순이며, 수집본 교체 시 첫 페이지부터 다시 조회합니다.")
    public ApiResponse<RentalTransactionPageResponse> findTransactions(
        @RequestParam final String legalDongCode,
        @RequestParam(defaultValue = "0") final int page,
        @RequestParam(defaultValue = "20") final int size
    ) {
        return ApiResponse.of(RentalTransactionPageResponse.from(service.findTransactions(legalDongCode, page, size)));
    }
}
