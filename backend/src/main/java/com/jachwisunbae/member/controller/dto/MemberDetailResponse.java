package com.jachwisunbae.member.controller.dto;

import com.jachwisunbae.member.service.dto.result.MemberProfile;
import io.swagger.v3.oas.annotations.media.Schema;

public record MemberDetailResponse(
    @Schema(description = "회원 ID")
    long id
) {

    public static MemberDetailResponse from(MemberProfile profile) {
        return new MemberDetailResponse(profile.id());
    }
}
