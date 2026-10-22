package com.jachwisunbae.auth.service;

import com.jachwisunbae.auth.domain.RefreshToken;
import com.jachwisunbae.auth.repository.RefreshTokenRepository;
import com.jachwisunbae.auth.service.dto.LoginResult;
import com.jachwisunbae.auth.token.JwtTokenProvider;
import com.jachwisunbae.auth.token.RefreshTokenProvider;
import com.jachwisunbae.member.entity.Member;
import com.jachwisunbae.member.repository.MemberRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
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

    public AuthService(
            MemberRepository memberRepository,
            RefreshTokenRepository refreshTokenRepository,
            JwtTokenProvider jwtProvider,
            RefreshTokenProvider refreshTokenProvider,
            Clock clock,
            @Value("${auth.jwt.access-token-seconds}") long accessTokenSeconds) {
        this.memberRepository = memberRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.jwtProvider = jwtProvider;
        this.refreshTokenProvider = refreshTokenProvider;
        this.clock = clock;
        this.accessTokenSeconds = accessTokenSeconds;
    }

    @Transactional
    public LoginResult startAnonymous() {
        LocalDateTime now = LocalDateTime.now(clock);
        Member member = memberRepository.save(Member.create(now));

        String rawToken = refreshTokenProvider.generateToken();
        String tokenHash = refreshTokenProvider.hash(rawToken);
        RefreshToken refreshToken = RefreshToken.create(member.getId(), tokenHash, now);

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
