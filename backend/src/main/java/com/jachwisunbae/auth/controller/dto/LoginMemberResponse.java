package com.jachwisunbae.auth.controller.dto;

import io.swagger.v3.oas.annotations.media.Schema;

public record LoginMemberResponse(
        @Schema(description = "회원 ID")
        Long memberId
) {
}
