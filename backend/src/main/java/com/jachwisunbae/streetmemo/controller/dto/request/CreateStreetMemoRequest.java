package com.jachwisunbae.streetmemo.controller.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record CreateStreetMemoRequest(
        @Schema(description = "메모 대상 위치의 위도(-90 이상 90 이하)", example = "37.5")
        @NotNull
        BigDecimal latitude,

        @Schema(description = "메모 대상 위치의 경도(-180 이상 180 이하)", example = "127.0")
        @NotNull
        BigDecimal longitude,

        @Schema(description = "메모 내용. 입력한 공백과 줄바꿈을 유지한다.", example = "늦게까지 여는 세탁소가 있어요.")
        @NotNull
        String memo,

        @Schema(description = "작성자가 선택한 선호. 대문자 코드만 허용한다.",
                allowableValues = {"LIKE", "DISLIKE"}, example = "LIKE")
        @NotNull
        String preference
) {
}
