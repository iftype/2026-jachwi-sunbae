package com.jachwisunbae.bookmark.controller.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

public record AddAdminDongBookmarkRequest(
        @Schema(description = "북마크할 8자리 행정동 코드", example = "11680640")
        @NotNull
        String adminDongCode
) {
}
