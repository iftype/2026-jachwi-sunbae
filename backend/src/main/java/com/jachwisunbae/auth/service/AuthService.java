package com.jachwisunbae.auth.service;

import com.jachwisunbae.auth.domain.RefreshToken;
import com.jachwisunbae.auth.repository.RefreshTokenRepository;
import com.jachwisunbae.auth.service.dto.LoginResult;
import com.jachwisunbae.auth.token.JwtTokenProvider;
import com.jachwisunbae.auth.token.RefreshTokenProvider;
import com.jachwisunbae.common.exception.client.AuthenticationFailedException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.member.entity.Member;
import com.jachwisunbae.member.repository.MemberRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final MemberRepository memberRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtTokenProvider jwtProvider;
    private final RefreshTokenProvider refreshTokenProvider;
    private final Clock clock;
    private final long accessTokenSeconds;
    private final long refreshTokenValidityDays;

    public AuthService(
            MemberRepository memberRepository,
            RefreshTokenRepository refreshTokenRepository,
            JwtTokenProvider jwtProvider,
            RefreshTokenProvider refreshTokenProvider,
            Clock clock,
            @Value("${auth.jwt.access-token-seconds}") long accessTokenSeconds,
            @Value("${auth.refresh-token.validity-days}") long refreshTokenValidityDays) {
        this.memberRepository = memberRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.jwtProvider = jwtProvider;
        this.refreshTokenProvider = refreshTokenProvider;
        this.clock = clock;
        this.accessTokenSeconds = accessTokenSeconds;
        this.refreshTokenValidityDays = refreshTokenValidityDays;
    }

    @Transactional
    public LoginResult startAnonymous(String rawToken) {
        LocalDateTime now = LocalDateTime.now(clock);
        return restoreAuthentication(rawToken, now).orElseGet(() -> createAnonymous(now));
    }

    @Transactional
    public LoginResult refresh(String rawToken) {
        LocalDateTime now = LocalDateTime.now(clock);
        return restoreAuthentication(rawToken, now).orElseThrow(() ->
                new AuthenticationFailedException(ErrorCode.REFRESH_TOKEN_INVALID,
                        "Refresh Token으로 정상 회원의 인증을 복원할 수 없습니다."));
    }

    private Optional<LoginResult> restoreAuthentication(String rawToken, LocalDateTime now) {
        if (rawToken == null || rawToken.isBlank()) {
            return Optional.empty();
        }

        String tokenHash = refreshTokenProvider.hash(rawToken);
        Optional<RefreshToken> storedToken = refreshTokenRepository.findByTokenHash(tokenHash);
        if (storedToken.isEmpty() || storedToken.get().isExpiredAt(now)) {
            return Optional.empty();
        }

        RefreshToken refreshToken = storedToken.get();
        Optional<Member> member = memberRepository.findById(refreshToken.getMemberId());
        if (member.isEmpty()) {
            return Optional.empty();
        }

        refreshToken.extendExpiry(now, refreshTokenValidityDays);
        if (refreshTokenRepository.updateExpiry(refreshToken) == 0) {
            return Optional.empty();
        }

        long refreshTokenExpiresIn = Duration.between(now, refreshToken.getExpiresAt()).getSeconds();
        return Optional.of(createLoginResult(member.get(), false, rawToken, refreshTokenExpiresIn));
    }

    private LoginResult createAnonymous(LocalDateTime now) {
        Member member = memberRepository.save(Member.create(now));

        String rawToken = refreshTokenProvider.generateToken();
        String tokenHash = refreshTokenProvider.hash(rawToken);
        RefreshToken refreshToken = RefreshToken.create(member.getId(), tokenHash, now, refreshTokenValidityDays);

        refreshTokenRepository.save(refreshToken);
        long refreshTokenExpiresIn = Duration.between(now, refreshToken.getExpiresAt()).getSeconds();
        return createLoginResult(member, true, rawToken, refreshTokenExpiresIn);
    }

    private LoginResult createLoginResult(Member member, boolean newMember,
                                         String rawToken, long refreshTokenExpiresIn) {
        return new LoginResult(member.getId(), newMember,
                jwtProvider.createAccessToken(member.getId()), accessTokenSeconds,
                rawToken, refreshTokenExpiresIn);
    }
}
