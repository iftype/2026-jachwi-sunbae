package com.jachwisunbae.auth.service;

import com.jachwisunbae.auth.service.dto.LoginResult;
import com.jachwisunbae.auth.token.JwtTokenProvider;
import com.jachwisunbae.member.entity.Member;
import com.jachwisunbae.member.repository.MemberRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

// 조회와 저장을 트랜잭션으로 묶지 않는다. 동시 가입은 DB 유니크 제약이 막고, 충돌한 뒤 다시 조회할 때
// 먼저 저장된 회원이 보여야 하기 때문이다. 트랜잭션 안에서는 MySQL이 처음 조회한 시점의 데이터를 계속 보여준다.
@Service
public class AuthService {

    private final MemberRepository memberRepository;
    private final JwtTokenProvider jwtProvider;
    private final Clock clock;
    private final long accessTokenSeconds;

    public AuthService(
            MemberRepository memberRepository,
            JwtTokenProvider jwtProvider,
            Clock clock,
            @Value("${auth.jwt.access-token-seconds}") long accessTokenSeconds) {
        this.memberRepository = memberRepository;
        this.jwtProvider = jwtProvider;
        this.clock = clock;
        this.accessTokenSeconds = accessTokenSeconds;
    }

    public LoginResult startAnonymous() {
        LocalDateTime now = LocalDateTime.now(clock);
        Member member = memberRepository.save(Member.create(now));
        return createLoginResult(member, true);
    }

    private LoginResult createLoginResult(Member member, boolean newMember) {
        return new LoginResult(jwtProvider.createAccessToken(member.getId()), accessTokenSeconds, newMember,
                member.getId());
    }
}
