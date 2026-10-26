package com.jachwisunbae.auth.domain;

import com.jachwisunbae.common.entity.BaseTimeEntity;
import java.time.LocalDateTime;
import java.util.regex.Pattern;
import lombok.Getter;

@Getter
public class RefreshToken extends BaseTimeEntity {

    private static final Pattern TOKEN_HASH_PATTERN = Pattern.compile("[0-9a-f]{64}");

    private final Long id;
    private final Long memberId;
    private final String tokenHash;
    private LocalDateTime expiresAt;

    private RefreshToken(final Long id, final Long memberId, final String tokenHash,
                         final LocalDateTime createdAt, final LocalDateTime updatedAt,
                         final LocalDateTime expiresAt) {
        super(requireTime(createdAt, "생성 시각"), requireTime(updatedAt, "수정 시각"));
        validateTimestamps(createdAt, updatedAt, expiresAt);
        this.id = id;
        this.memberId = requirePositiveId(memberId, "회원 ID");
        this.tokenHash = validateTokenHash(tokenHash);
        this.expiresAt = expiresAt;
    }

    public static RefreshToken create(final Long memberId, final String tokenHash, final LocalDateTime now,
                                      final long validityDays) {
        requireTime(now, "생성 시각");
        requirePositiveValidityDays(validityDays);
        return new RefreshToken(null, memberId, tokenHash, now, now, now.plusDays(validityDays));
    }

    public static RefreshToken reconstruct(final Long id, final Long memberId, final String tokenHash,
                                           final LocalDateTime createdAt, final LocalDateTime updatedAt,
                                           final LocalDateTime expiresAt) {
        return new RefreshToken(requirePositiveId(id, "Refresh Token ID"), memberId, tokenHash,
                createdAt, updatedAt, expiresAt);
    }

    public boolean isExpiredAt(final LocalDateTime now) {
        requireTime(now, "판단 시각");
        return !expiresAt.isAfter(now);
    }

    public void extendExpiry(final LocalDateTime now, final long validityDays) {
        requireTime(now, "갱신 시각");
        requirePositiveValidityDays(validityDays);
        if (now.isBefore(getUpdatedAt())) {
            throw new IllegalArgumentException("갱신 시각은 마지막 수정 시각보다 빠를 수 없습니다.");
        }
        if (!expiresAt.isAfter(now)) {
            throw new IllegalStateException("만료된 Refresh Token은 연장할 수 없습니다.");
        }
        this.expiresAt = now.plusDays(validityDays);
        updateUpdatedAt(now);
    }

    private static void requirePositiveValidityDays(final long validityDays) {
        if (validityDays <= 0) {
            throw new IllegalArgumentException("Refresh Token 유효기간은 양수여야 합니다.");
        }
    }

    private static Long requirePositiveId(final Long id, final String name) {
        if (id == null || id <= 0) {
            throw new IllegalArgumentException(name + "는 양수여야 합니다.");
        }
        return id;
    }

    private static String validateTokenHash(final String tokenHash) {
        if (tokenHash == null || !TOKEN_HASH_PATTERN.matcher(tokenHash).matches()) {
            throw new IllegalArgumentException("Refresh Token 해시는 64자리 소문자 16진수여야 합니다.");
        }
        return tokenHash;
    }

    private static LocalDateTime requireTime(final LocalDateTime time, final String name) {
        if (time == null) {
            throw new IllegalArgumentException(name + "은 필수입니다.");
        }
        return time;
    }

    private static void validateTimestamps(final LocalDateTime createdAt, final LocalDateTime updatedAt,
                                           final LocalDateTime expiresAt) {
        requireTime(expiresAt, "만료 시각");
        if (updatedAt.isBefore(createdAt)) {
            throw new IllegalArgumentException("수정 시각은 생성 시각보다 빠를 수 없습니다.");
        }
        if (!expiresAt.isAfter(updatedAt)) {
            throw new IllegalArgumentException("만료 시각은 수정 시각보다 늦어야 합니다.");
        }
    }
}
