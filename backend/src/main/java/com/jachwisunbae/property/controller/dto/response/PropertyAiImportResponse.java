package com.jachwisunbae.property.controller.dto.response;

import com.jachwisunbae.property.entity.Property;
import io.swagger.v3.oas.annotations.media.Schema;

public record PropertyAiImportResponse(
    @Schema(description = "AI 추출 결과를 반영해 저장한 매물 기본 정보")
    UpdatePropertyResponse property,

    @Schema(description = "AI 추출 메모를 덧붙여 저장한 자유 메모")
    String freeMemo
) {
    public static PropertyAiImportResponse from(final Property property) {
        return new PropertyAiImportResponse(UpdatePropertyResponse.from(property), property.getMemo());
    }
}
