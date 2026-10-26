package com.jachwisunbae.member.entity;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class MemberTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 9, 28, 0, 0);

    @Test
    @DisplayName("익명 회원을 생성하면 생성 시각과 수정 시각이 같고 삭제 시각은 없다")
    void createsAnonymousMember() {
        Member member = Member.create(NOW);

        assertThat(member.getId()).isNull();
        assertThat(member.getCreatedAt()).isEqualTo(NOW);
        assertThat(member.getUpdatedAt()).isEqualTo(NOW);
        assertThat(member.getDeletedAt()).isNull();
    }

    @Test
    @DisplayName("정상 회원의 식별자와 생성 및 수정 시각을 복원한다")
    void reconstructsActiveMember() {
        LocalDateTime updatedAt = NOW.plusDays(1);

        Member member = Member.reconstruct(7L, NOW, updatedAt, null);

        assertThat(member.getId()).isEqualTo(7L);
        assertThat(member.getCreatedAt()).isEqualTo(NOW);
        assertThat(member.getUpdatedAt()).isEqualTo(updatedAt);
        assertThat(member.getDeletedAt()).isNull();
    }

    @Test
    @DisplayName("삭제 시각이 있는 회원도 상태를 유지해 복원한다")
    void reconstructsDeletedMember() {
        LocalDateTime deletedAt = NOW.plusDays(1);

        Member member = Member.reconstruct(7L, NOW, deletedAt, deletedAt);

        assertThat(member.getDeletedAt()).isEqualTo(deletedAt);
    }
}
