package com.jachwisunbae.bookmark.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.jachwisunbae.member.repository.JdbcMemberRepository;
import java.time.LocalDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.jdbc.JdbcTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@JdbcTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class JdbcAdminDongBookmarkRepositoryTest {

    @Container
    @ServiceConnection
    private static final MySQLContainer<?> mysqlContainer = new MySQLContainer<>("mysql:8.4.10");

    private static final long MEMBER_ID = 1L;
    private static final long OTHER_MEMBER_ID = 2L;
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 18, 9, 0);

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private JdbcAdminDongBookmarkRepository repository;
    private JdbcMemberRepository memberRepository;

    @BeforeEach
    void setUp() {
        repository = new JdbcAdminDongBookmarkRepository(jdbcTemplate);
        memberRepository = new JdbcMemberRepository(jdbcTemplate);
        insertMember(MEMBER_ID);
        insertMember(OTHER_MEMBER_ID);
    }

    @Test
    @DisplayName("같은 행정동을 다시 북마크해도 한 행만 남고 최근에 추가한 순서로 읽는다")
    void addsIdempotentlyAndReadsNewestFirst() {
        repository.add(MEMBER_ID, "11010530", NOW);
        repository.add(MEMBER_ID, "11680640", NOW.plusMinutes(1));
        repository.add(MEMBER_ID, "11010530", NOW.plusMinutes(2));
        repository.add(OTHER_MEMBER_ID, "41135545", NOW);

        assertThat(repository.findCodesByMemberId(MEMBER_ID)).containsExactly("11680640", "11010530");
        assertThat(repository.findCodesByMemberId(OTHER_MEMBER_ID)).containsExactly("41135545");
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM admin_dong_bookmarks WHERE member_id = ?",
                Long.class, MEMBER_ID)).isEqualTo(2);
    }

    @Test
    @DisplayName("해제한 북마크는 목록에서 빠지고, 다시 추가하면 같은 행을 되살려 맨 앞에 둔다")
    void removesAndRestores() {
        repository.add(MEMBER_ID, "11010530", NOW);
        repository.add(MEMBER_ID, "11680640", NOW.plusMinutes(1));

        assertThat(repository.remove(MEMBER_ID, "11010530", NOW.plusMinutes(2))).isOne();
        assertThat(repository.remove(MEMBER_ID, "11010530", NOW.plusMinutes(3))).isZero();
        assertThat(repository.remove(OTHER_MEMBER_ID, "11680640", NOW.plusMinutes(3))).isZero();
        assertThat(repository.findCodesByMemberId(MEMBER_ID)).containsExactly("11680640");

        repository.add(MEMBER_ID, "11010530", NOW.plusMinutes(4));
        assertThat(repository.findCodesByMemberId(MEMBER_ID)).containsExactly("11010530", "11680640");
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM admin_dong_bookmarks WHERE member_id = ?",
                Long.class, MEMBER_ID)).isEqualTo(2);
    }

    @Test
    @DisplayName("회원을 합치면 북마크를 옮기고, 겹치는 행정동은 하나로 합치며 해제한 쪽도 되살린다")
    void mergesBookmarksIntoTargetMember() {
        repository.add(MEMBER_ID, "11010530", NOW);
        repository.add(MEMBER_ID, "11680640", NOW);
        repository.add(MEMBER_ID, "41135545", NOW);
        repository.remove(MEMBER_ID, "41135545", NOW.plusMinutes(1));
        repository.add(OTHER_MEMBER_ID, "11680640", NOW.minusMinutes(1));
        repository.add(OTHER_MEMBER_ID, "26110510", NOW.minusMinutes(1));
        repository.remove(OTHER_MEMBER_ID, "26110510", NOW);
        repository.add(MEMBER_ID, "26110510", NOW.plusMinutes(2));

        memberRepository.mergeOwnedData(MEMBER_ID, OTHER_MEMBER_ID, NOW.plusMinutes(3));

        assertThat(repository.findCodesByMemberId(OTHER_MEMBER_ID))
                .containsExactlyInAnyOrder("11010530", "11680640", "26110510");
        assertThat(repository.findCodesByMemberId(MEMBER_ID)).isEmpty();
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM admin_dong_bookmarks WHERE member_id = ?",
                Long.class, MEMBER_ID)).isZero();
    }

    @Test
    @DisplayName("회원 탈퇴 기록 정리에서 그 회원의 북마크만 해제한다")
    void deletesBookmarksWithOwnedData() {
        repository.add(MEMBER_ID, "11010530", NOW);
        repository.add(OTHER_MEMBER_ID, "11010530", NOW);

        memberRepository.deleteOwnedData(MEMBER_ID, NOW.plusMinutes(1));

        assertThat(repository.findCodesByMemberId(MEMBER_ID)).isEmpty();
        assertThat(repository.findCodesByMemberId(OTHER_MEMBER_ID)).containsExactly("11010530");
    }

    private void insertMember(final long id) {
        jdbcTemplate.update("INSERT INTO members (id, created_at, updated_at) VALUES (?, NOW(6), NOW(6))", id);
    }
}
