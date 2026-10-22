package com.jachwisunbae.auth.service.dto;

public record LoginResult(
        Long memberId,
        boolean newMember,
        String accessToken,
        long accessTokenExpiresIn,
        String refreshToken,
        long refreshTokenExpiresIn
) {
}
