package com.jachwisunbae.member.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.server.DataInconsistencyException;
import com.jachwisunbae.member.entity.Member;
import java.time.LocalDateTime;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

// 닉네임 비교와 유니크 제약은 MySQL collation에 달려 있어 실제 MySQL로 검증한다.
@Testcontainers
class JdbcMemberRepositoryTest {

    @Container
    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.10");
    private static final LocalDateTime NOW = LocalDateTime.parse("2026-09-28T00:00:00");

    private static JdbcTemplate jdbcTemplate;
    private static JdbcMemberRepository memberRepository;

    @BeforeAll
    static void setUpSchema() {
        DataSource dataSource = new DriverManagerDataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(),
                MYSQL.getPassword());
        Flyway.configure().dataSource(dataSource).load().migrate();
        jdbcTemplate = new JdbcTemplate(dataSource);
        memberRepository = new JdbcMemberRepository(jdbcTemplate);
    }

    @BeforeEach
    void clearMembers() {
        jdbcTemplate.update("DELETE FROM members");
    }

    @Test
    @DisplayName("같은 닉네임에 공유 회원과 보호 회원을 각각 저장하고 보호 여부로 구분해 조회한다")
    void storesSharedAndProtectedMembersWithSameNickname() {
        Member shared = memberRepository.save(Member.create("11", null, NOW));
        Member protectedMember = memberRepository.save(Member.create("11", "{pbkdf2}hash", NOW));

        assertThat(memberRepository.findByNicknameAndPasswordProtected("11", false))
                .get().extracting(Member::getId).isEqualTo(shared.getId());
        assertThat(memberRepository.findByNicknameAndPasswordProtected("11", true))
                .get().extracting(Member::getId).isEqualTo(protectedMember.getId());
    }

    @Test
    @DisplayName("같은 닉네임의 보호 회원은 하나만 저장할 수 있다")
    void rejectsSecondProtectedMemberWithSameNickname() {
        memberRepository.save(Member.create("11", "{pbkdf2}hash-a", NOW));

        assertThatThrownBy(() -> memberRepository.save(Member.create("11", "{pbkdf2}hash-b", NOW)))
                .isInstanceOf(DuplicateKeyException.class);
    }

    @Test
    @DisplayName("대소문자가 다른 닉네임은 다른 회원으로 저장하고 조회한다")
    void distinguishesNicknameCase() {
        Member upper = memberRepository.save(Member.create("Lee", null, NOW));
        Member lower = memberRepository.save(Member.create("lee", null, NOW));

        assertThat(memberRepository.findByNicknameAndPasswordProtected("Lee", false))
                .get().extracting(Member::getId).isEqualTo(upper.getId());
        assertThat(memberRepository.findByNicknameAndPasswordProtected("lee", false))
                .get().extracting(Member::getId).isEqualTo(lower.getId());
        assertThat(memberRepository.findByNicknameAndPasswordProtected("LEE", false)).isEmpty();
    }

    @Test
    @DisplayName("저장된 닉네임이 회원 규칙을 만족하지 않으면 사용자 입력 오류가 아니라 서버 데이터 오류로 본다")
    void rejectsInvalidStoredNicknameAsDataInconsistency() {
        jdbcTemplate.update("""
                INSERT INTO members (id, nickname, password_hash, created_at, updated_at)
                VALUES (999, ?, NULL, NOW(6), NOW(6))
                """, "가".repeat(31));

        assertThatThrownBy(() -> memberRepository.findById(999L))
                .isInstanceOf(DataInconsistencyException.class)
                .hasCauseInstanceOf(InvalidInputException.class);
    }
}
