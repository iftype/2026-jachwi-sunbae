package com.jachwisunbae.auth.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDateTime;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

class RefreshTokenTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2027, 10, 22, 12, 0);
    private static final String TOKEN_HASH = "a1".repeat(32);
    private static final long VALIDITY_DAYS = 365;

    @Test
    @DisplayName("새 토큰은 ID 없이 생성하고 윤년을 지나도 정확히 365일 후 만료된다")
    void createsTokenWith365DayLifetime() {
        RefreshToken token = RefreshToken.create(7L, TOKEN_HASH, NOW, VALIDITY_DAYS);

        assertThat(token.getId()).isNull();
        assertThat(token.getMemberId()).isEqualTo(7L);
        assertThat(token.getTokenHash()).isEqualTo(TOKEN_HASH);
        assertThat(token.getCreatedAt()).isEqualTo(NOW);
        assertThat(token.getUpdatedAt()).isEqualTo(NOW);
        assertThat(token.getExpiresAt()).isEqualTo(NOW.plusDays(365));
    }

    @Test
    @DisplayName("전달받은 유효기간을 생성과 갱신에 적용한다")
    void usesConfiguredValidityDays() {
        RefreshToken token = RefreshToken.create(7L, TOKEN_HASH, NOW, 30);
        assertThat(token.getExpiresAt()).isEqualTo(NOW.plusDays(30));

        LocalDateTime renewedAt = NOW.plusDays(1);
        token.extendExpiry(renewedAt, 90);

        assertThat(token.getExpiresAt()).isEqualTo(renewedAt.plusDays(90));
    }

    @ParameterizedTest
    @ValueSource(longs = {0, -1})
    @DisplayName("유효기간이 양수가 아니면 생성과 갱신을 거부한다")
    void rejectsNonPositiveValidityDays(long validityDays) {
        assertThatThrownBy(() -> RefreshToken.create(7L, TOKEN_HASH, NOW, validityDays))
                .isInstanceOf(IllegalArgumentException.class);

        RefreshToken token = RefreshToken.create(7L, TOKEN_HASH, NOW, VALIDITY_DAYS);
        LocalDateTime expiresAt = token.getExpiresAt();
        assertThatThrownBy(() -> token.extendExpiry(NOW.plusDays(1), validityDays))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(token.getExpiresAt()).isEqualTo(expiresAt);
        assertThat(token.getUpdatedAt()).isEqualTo(NOW);
    }

    @Test
    @DisplayName("저장된 토큰의 식별자와 시각을 그대로 복원한다")
    void reconstructsStoredToken() {
        LocalDateTime updatedAt = NOW.plusDays(1);
        LocalDateTime expiresAt = updatedAt.plusDays(365);

        RefreshToken token = RefreshToken.reconstruct(10L, 7L, TOKEN_HASH, NOW, updatedAt, expiresAt);

        assertThat(token.getId()).isEqualTo(10L);
        assertThat(token.getMemberId()).isEqualTo(7L);
        assertThat(token.getTokenHash()).isEqualTo(TOKEN_HASH);
        assertThat(token.getCreatedAt()).isEqualTo(NOW);
        assertThat(token.getUpdatedAt()).isEqualTo(updatedAt);
        assertThat(token.getExpiresAt()).isEqualTo(expiresAt);
    }

    @Test
    @DisplayName("이미 만료된 토큰도 만료 여부를 판단하기 위해 복원할 수 있다")
    void reconstructsExpiredToken() {
        LocalDateTime expiresAt = NOW.minusDays(1);

        RefreshToken token = RefreshToken.reconstruct(10L, 7L, TOKEN_HASH,
                NOW.minusDays(400), NOW.minusDays(366), expiresAt);

        assertThat(token.getExpiresAt()).isEqualTo(expiresAt);
        assertThat(token.isExpiredAt(NOW)).isTrue();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(longs = {0, -1})
    @DisplayName("회원 ID가 없거나 양수가 아니면 생성과 복원을 거부한다")
    void rejectsInvalidMemberId(Long memberId) {
        assertThatThrownBy(() -> RefreshToken.create(memberId, TOKEN_HASH, NOW, VALIDITY_DAYS))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> RefreshToken.reconstruct(10L, memberId, TOKEN_HASH,
                NOW, NOW, NOW.plusDays(365)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(longs = {0, -1})
    @DisplayName("저장된 토큰을 복원할 때 토큰 ID는 양수여야 한다")
    void rejectsInvalidStoredId(Long id) {
        assertThatThrownBy(() -> RefreshToken.reconstruct(id, 7L, TOKEN_HASH,
                NOW, NOW, NOW.plusDays(365)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @MethodSource("invalidTokenHashes")
    @DisplayName("토큰 해시는 64자리 소문자 16진수여야 한다")
    void rejectsInvalidTokenHash(String tokenHash) {
        assertThatThrownBy(() -> RefreshToken.create(7L, tokenHash, NOW, VALIDITY_DAYS))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> RefreshToken.reconstruct(10L, 7L, tokenHash,
                NOW, NOW, NOW.plusDays(365)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static Stream<String> invalidTokenHashes() {
        return Stream.of(null, "", " ", "a".repeat(63), "a".repeat(65), "g".repeat(64), "A".repeat(64));
    }

    @Test
    @DisplayName("생성 시각이 없으면 내부 검증 예외가 발생한다")
    void rejectsMissingCreationTime() {
        assertThatThrownBy(() -> RefreshToken.create(7L, TOKEN_HASH, null, VALIDITY_DAYS))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @MethodSource("missingTimestamps")
    @DisplayName("생성·수정·만료 시각 중 하나라도 없으면 복원을 거부한다")
    void rejectsMissingStoredTimestamp(LocalDateTime createdAt, LocalDateTime updatedAt, LocalDateTime expiresAt) {
        assertThatThrownBy(() -> RefreshToken.reconstruct(10L, 7L, TOKEN_HASH,
                createdAt, updatedAt, expiresAt))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static Stream<Arguments> missingTimestamps() {
        return Stream.of(
                Arguments.of(null, NOW, NOW.plusDays(365)),
                Arguments.of(NOW, null, NOW.plusDays(365)),
                Arguments.of(NOW, NOW, null));
    }

    @Test
    @DisplayName("수정 시각이 생성 시각보다 빠르면 복원을 거부한다")
    void rejectsUpdateBeforeCreation() {
        assertThatThrownBy(() -> RefreshToken.reconstruct(10L, 7L, TOKEN_HASH,
                NOW, NOW.minusSeconds(1), NOW.plusDays(365)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @ValueSource(ints = {-1, 0})
    @DisplayName("만료 시각이 수정 시각보다 늦지 않으면 복원을 거부한다")
    void rejectsExpiryNotAfterUpdate(int secondsAfterUpdate) {
        LocalDateTime updatedAt = NOW.plusDays(1);

        assertThatThrownBy(() -> RefreshToken.reconstruct(10L, 7L, TOKEN_HASH,
                NOW, updatedAt, updatedAt.plusSeconds(secondsAfterUpdate)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @CsvSource({"-1,false", "0,true", "1,true"})
    @DisplayName("만료 직전에는 유효하고 만료 시각과 같거나 이후이면 만료된다")
    void checksExpiryBoundary(int secondsAfterExpiry, boolean expired) {
        RefreshToken token = RefreshToken.create(7L, TOKEN_HASH, NOW, VALIDITY_DAYS);

        LocalDateTime checkedAt = token.getExpiresAt().plusSeconds(secondsAfterExpiry);

        assertThat(token.isExpiredAt(checkedAt)).isEqualTo(expired);
    }

    @Test
    @DisplayName("만료를 판단할 시각은 필수다")
    void rejectsMissingExpiryCheckTime() {
        RefreshToken token = RefreshToken.create(7L, TOKEN_HASH, NOW, VALIDITY_DAYS);

        assertThatThrownBy(() -> token.isExpiredAt(null)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("갱신하면 토큰 값과 생성 시각을 유지하고 갱신 시점부터 365일로 연장한다")
    void extendsExpiryFromRenewalTime() {
        RefreshToken token = RefreshToken.reconstruct(10L, 7L, TOKEN_HASH, NOW, NOW, NOW.plusDays(365));
        LocalDateTime renewedAt = NOW.plusDays(30);

        token.extendExpiry(renewedAt, VALIDITY_DAYS);

        assertThat(token.getId()).isEqualTo(10L);
        assertThat(token.getMemberId()).isEqualTo(7L);
        assertThat(token.getTokenHash()).isEqualTo(TOKEN_HASH);
        assertThat(token.getCreatedAt()).isEqualTo(NOW);
        assertThat(token.getUpdatedAt()).isEqualTo(renewedAt);
        assertThat(token.getExpiresAt()).isEqualTo(renewedAt.plusDays(365));
    }

    @Test
    @DisplayName("같은 시각에 중복 갱신해도 정상적으로 유지한다")
    void allowsRepeatedRenewalAtSameTime() {
        RefreshToken token = RefreshToken.create(7L, TOKEN_HASH, NOW, VALIDITY_DAYS);
        LocalDateTime renewedAt = NOW.plusDays(1);
        token.extendExpiry(renewedAt, VALIDITY_DAYS);
        LocalDateTime expiresAt = token.getExpiresAt();

        token.extendExpiry(renewedAt, VALIDITY_DAYS);

        assertThat(token.getExpiresAt()).isEqualTo(expiresAt);
        assertThat(token.getUpdatedAt()).isEqualTo(renewedAt);
        assertThat(token.getTokenHash()).isEqualTo(TOKEN_HASH);
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 1})
    @DisplayName("만료 시각과 같거나 이후에 연장하면 거부하고 기존 상태를 유지한다")
    void rejectsRenewalOfExpiredToken(int secondsAfterExpiry) {
        RefreshToken token = RefreshToken.create(7L, TOKEN_HASH, NOW, VALIDITY_DAYS);
        LocalDateTime expiresAt = token.getExpiresAt();
        LocalDateTime renewedAt = expiresAt.plusSeconds(secondsAfterExpiry);

        assertThatThrownBy(() -> token.extendExpiry(renewedAt, VALIDITY_DAYS))
                .isInstanceOf(IllegalStateException.class);
        assertThat(token.getExpiresAt()).isEqualTo(expiresAt);
        assertThat(token.getUpdatedAt()).isEqualTo(NOW);
    }

    @Test
    @DisplayName("갱신 시각이 없으면 거부하고 기존 상태를 유지한다")
    void rejectsMissingRenewalTime() {
        RefreshToken token = RefreshToken.create(7L, TOKEN_HASH, NOW, VALIDITY_DAYS);
        LocalDateTime expiresAt = token.getExpiresAt();

        assertThatThrownBy(() -> token.extendExpiry(null, VALIDITY_DAYS))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(token.getExpiresAt()).isEqualTo(expiresAt);
        assertThat(token.getUpdatedAt()).isEqualTo(NOW);
    }

    @Test
    @DisplayName("마지막 수정 시각보다 과거로 갱신하면 거부하고 기존 상태를 유지한다")
    void rejectsRenewalBeforeLastUpdate() {
        LocalDateTime updatedAt = NOW.plusDays(1);
        LocalDateTime expiresAt = updatedAt.plusDays(365);
        RefreshToken token = RefreshToken.reconstruct(10L, 7L, TOKEN_HASH, NOW, updatedAt, expiresAt);

        assertThatThrownBy(() -> token.extendExpiry(NOW, VALIDITY_DAYS))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(token.getExpiresAt()).isEqualTo(expiresAt);
        assertThat(token.getUpdatedAt()).isEqualTo(updatedAt);
    }

    @Test
    @DisplayName("생성과 만료 판단에 전달받은 시각을 기준으로 사용한다")
    void usesProvidedTime() {
        LocalDateTime createdAt = NOW.plusHours(9);

        RefreshToken token = RefreshToken.create(7L, TOKEN_HASH, createdAt, VALIDITY_DAYS);

        assertThat(token.getCreatedAt()).isEqualTo(createdAt);
        assertThat(token.getUpdatedAt()).isEqualTo(token.getCreatedAt());
        assertThat(token.getExpiresAt()).isEqualTo(createdAt.plusDays(365));
        assertThat(token.isExpiredAt(createdAt)).isFalse();
    }
}
