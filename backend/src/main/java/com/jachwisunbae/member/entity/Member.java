package com.jachwisunbae.member.entity;

import lombok.Getter;
import com.jachwisunbae.common.entity.BaseTimeEntity;

import java.time.LocalDateTime;

@Getter
public class Member extends BaseTimeEntity {

    private final Long id;
    private final LocalDateTime deletedAt;

    private Member(final Long id, final LocalDateTime createdAt, final LocalDateTime updatedAt,
                   final LocalDateTime deletedAt) {
        super(createdAt, updatedAt);
        this.id = id;
        this.deletedAt = deletedAt;
    }

    public static Member create(final LocalDateTime now) {
        return new Member(null, now, now, null);
    }

    public static Member reconstruct(final Long id, final LocalDateTime createdAt,
                                     final LocalDateTime updatedAt, final LocalDateTime deletedAt) {
        return new Member(id, createdAt, updatedAt, deletedAt);
    }
}
