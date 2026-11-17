package com.jachwisunbae.property.controller;

import com.jachwisunbae.auth.web.AuthenticatedMemberId;
import com.jachwisunbae.property.controller.dto.request.ExportPropertyComparisonRequest;
import com.jachwisunbae.property.service.pdf.PropertyComparisonPdfService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/properties")
@Tag(name = "Properties", description = "후보 매물 관리 API")
@SecurityRequirement(name = "bearerAuth")
public class PropertyExportController {

    private final PropertyComparisonPdfService propertyComparisonPdfService;

    public PropertyExportController(final PropertyComparisonPdfService propertyComparisonPdfService) {
        this.propertyComparisonPdfService = propertyComparisonPdfService;
    }

    @PostMapping(value = "/export.pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    @Operation(summary = "선택 매물 기록 비교 PDF",
            description = "소유한 매물 1~5개를 선택해 기본 정보, 사진, 메모와 두 단계 체크 기록을 PDF로 내려받습니다."
                    + " 점수나 추천은 생성하지 않습니다.")
    public ResponseEntity<byte[]> exportPdf(
            @AuthenticatedMemberId final Long memberId,
            @Valid @RequestBody final ExportPropertyComparisonRequest request) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"jachwi-sunbae-property-comparison.pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(propertyComparisonPdfService.export(memberId, request.propertyIds()));
    }
}
