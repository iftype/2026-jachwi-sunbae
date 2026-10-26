package com.jachwisunbae.auth.controller.dto;

import com.jachwisunbae.auth.service.dto.LoginResult;
import io.swagger.v3.oas.annotations.media.Schema;

public record LoginResponse(
        @Schema(description = "JWT Access Token")
        String accessToken,

        @Schema(description = "토큰 타입", example = "Bearer")
        String tokenType,

        @Schema(description = "Access Token 만료까지 남은 초", example = "900")
        long expiresIn,

        @Schema(description = "이번 요청에서 회원을 새로 만든 경우에만 true")
        boolean newMember,

        LoginMemberResponse member) {

    private static final String BEARER = "Bearer";

    public static LoginResponse from(LoginResult result) {
        return new LoginResponse(result.accessToken(), BEARER, result.accessTokenExpiresIn(), result.newMember(),
                new LoginMemberResponse(result.memberId()));
    }
}
