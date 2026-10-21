package com.jachwisunbae.auth.service.dto;

public record LoginResult(
        String accessToken,
        long expiresIn,
        boolean newMember,
        Long memberId
) {
}
