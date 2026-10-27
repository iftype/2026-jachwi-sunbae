package com.jachwisunbae.streetmemo.controller.dto.response;

import com.jachwisunbae.streetmemo.domain.StreetMemoPreference;
import com.jachwisunbae.streetmemo.service.dto.result.StreetMemoResult;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;

public record StreetMemoResponse(
        @Schema(description = "거리 메모 식별자", example = "1")
        Long streetMemoId,
        BigDecimal latitude,
        BigDecimal longitude,
        String memo,
        @Schema(description = "작성자가 선택한 선호", allowableValues = {"LIKE", "DISLIKE"})
        StreetMemoPreference preference,
        @Schema(description = "현재 인증된 회원이 작성한 메모인지 여부", example = "true")
        boolean isMine
) {

    public static StreetMemoResponse from(final StreetMemoResult result) {
        return new StreetMemoResponse(result.id(), result.latitude(), result.longitude(),
                result.memo(), result.preference(), result.isMine());
    }
}
