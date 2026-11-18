package com.jachwisunbae.bookmark.controller.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

public record AdminDongBookmarkResponse(
        @Schema(description = "북마크한 8자리 행정동 코드", example = "11680640")
        String adminDongCode
) {
}
