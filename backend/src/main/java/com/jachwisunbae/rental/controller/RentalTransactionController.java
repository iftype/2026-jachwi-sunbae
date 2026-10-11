package com.jachwisunbae.rental.controller;

import com.jachwisunbae.common.web.ApiResponse;
import com.jachwisunbae.common.web.error.ErrorResponse;
import com.jachwisunbae.rental.controller.dto.response.RentalTransactionPageResponse;
import com.jachwisunbae.rental.service.RentalTransactionQueryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/rental-transactions")
@Tag(name = "Rental transactions", description = "법정동별 소형 주택 월세 거래 참고 정보")
@SecurityRequirement(name = "bearerAuth")
public class RentalTransactionController {
    private final RentalTransactionQueryService service;

    public RentalTransactionController(final RentalTransactionQueryService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "법정동별 최근 월세 거래 조회", description = "인증이 필요합니다. 한국 날짜 기준 최근 6개월의 "
        + "5~10평 월세 사례를 계약일 내림차순, 동일 계약일은 거래 ID 내림차순으로 조회합니다. "
        + "주택 유형·면적·보증금 필터 입력은 필요하지 않습니다. 단독·다가구의 CONTRACT는 전용면적이 아닙니다. "
        + "원룸 여부와 현재 입주 가능한 매물 여부는 확인할 수 없습니다. 수집된 거래가 없거나 페이지 범위를 넘으면 "
        + "200과 빈 items를 반환합니다. 수집본 교체 중 페이지를 이동하면 다시 첫 페이지부터 조회하는 것이 권장됩니다.")
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "거래 목록 또는 빈 목록"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400",
            description = "RENTAL_QUERY_INVALID: 코드 또는 페이지 범위 오류. INVALID_REQUEST: 필수값 누락·타입 오류",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "ACCESS_TOKEN_INVALID: 인증 필요",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    public ApiResponse<RentalTransactionPageResponse> findTransactions(
        @Parameter(description = "숫자 10자리 법정동 코드", example = "1162010200", required = true)
        @RequestParam final String legalDongCode,
        @Parameter(description = "0부터 시작, 최대 10000", schema = @Schema(minimum = "0", maximum = "10000"))
        @RequestParam(defaultValue = "0") final int page,
        @Parameter(description = "페이지 크기 1~100, 기본 20", schema = @Schema(minimum = "1", maximum = "100"))
        @RequestParam(defaultValue = "20") final int size
    ) {
        return ApiResponse.of(RentalTransactionPageResponse.from(service.findTransactions(legalDongCode, page, size)));
    }
}
