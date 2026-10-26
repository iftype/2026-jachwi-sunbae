package com.jachwisunbae.member.service.dto.result;

import com.jachwisunbae.member.entity.Member;

public record MemberProfile(Long id) {

    public static MemberProfile from(Member member) {
        return new MemberProfile(member.getId());
    }
}
