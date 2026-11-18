package com.jachwisunbae.bookmark.controller.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

public record AdminDongBookmarksResponse(
        @Schema(description = "북마크한 행정동 코드. 최근에 추가한 순서", example = "[\"11680640\", \"41135545\"]")
        List<String> adminDongCodes
) {
}
