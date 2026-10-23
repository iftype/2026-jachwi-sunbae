package com.jachwisunbae.member.repository;

import com.jachwisunbae.member.entity.Member;

import java.util.Optional;

public interface MemberRepository {

    Optional<Member> findById(Long memberId);

    Optional<Member> findByIdForUpdate(Long memberId);

    Member save(Member member);
}
