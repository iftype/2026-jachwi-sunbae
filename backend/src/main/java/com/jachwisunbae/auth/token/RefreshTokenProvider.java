package com.jachwisunbae.auth.token;

import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.InternalSystemException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

public class RefreshTokenProvider {

    private static final int TOKEN_BYTES = 32;

    private final SecureRandom secureRandom = new SecureRandom();

    // 사용자에게 전달할 토큰 원문을 예측하기 어려운 난수로 생성한다.
    public String generateToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(bytes);

        // 난수 바이트를 쿠키에 담기 편한 URL-safe 문자열로 표현한다.
        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(bytes);
    }

    // 토큰 원문 대신 DB에 저장하고 조회할 SHA-256 해시를 계산한다.
    public String hash(final String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new IllegalArgumentException("Refresh Token 원문은 필수입니다.");
        }

        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] tokenBytes = rawToken.getBytes(StandardCharsets.UTF_8);
            byte[] hashBytes = digest.digest(tokenBytes);

            // SHA-256 결과 32바이트를 64자리 소문자 16진수로 표현한다.
            return HexFormat.of().formatHex(hashBytes);
        } catch (NoSuchAlgorithmException exception) {
            throw new InternalSystemException(
                    ErrorCode.INTERNAL_SERVER_ERROR,
                    "Refresh Token 해시에 필요한 SHA-256 알고리즘을 사용할 수 없습니다.",
                    exception
            );
        }
    }
}
