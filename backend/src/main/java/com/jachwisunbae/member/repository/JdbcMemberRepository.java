package com.jachwisunbae.member.repository;

import com.jachwisunbae.member.entity.Member;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.time.LocalDateTime;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcMemberRepository implements MemberRepository {

    private final JdbcTemplate jdbcTemplate;

    public JdbcMemberRepository(final JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public Optional<Member> findById(final Long memberId) {
        String sql = """
                SELECT id, created_at, updated_at
                FROM members
                WHERE id = ? AND deleted_at IS NULL AND merged_into_member_id IS NULL
                """;
        return jdbcTemplate.query(sql, memberRowMapper(), memberId).stream().findFirst();
    }

    @Override
    public Optional<Member> findByIdForUpdate(final Long memberId) {
        String sql = """
                SELECT id, created_at, updated_at
                FROM members
                WHERE id = ? AND deleted_at IS NULL AND merged_into_member_id IS NULL
                FOR UPDATE
                """;
        return jdbcTemplate.query(sql, memberRowMapper(), memberId).stream().findFirst();
    }

    @Override
    public Member save(final Member member) {
        String sql = """
                INSERT INTO members (created_at, updated_at, deleted_at)
                VALUES (?, ?, ?)
                """;
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            statement.setObject(1, member.getCreatedAt());
            statement.setObject(2, member.getUpdatedAt());
            statement.setObject(3, member.getDeletedAt());
            return statement;
        }, keyHolder);
        long memberId = keyHolder.getKey().longValue();
        return Member.reconstruct(memberId, member.getCreatedAt(), member.getUpdatedAt(), member.getDeletedAt());
    }

    @Override
    public void mergeOwnedData(Long source, Long target, LocalDateTime mergedAt) {
        // 사진의 복합 외래키는 매물 소유권 변경을 따라간다.
        jdbcTemplate.update("UPDATE properties SET member_id = ? WHERE member_id = ?", target, source);
        jdbcTemplate.update("UPDATE user_checklists SET member_id = ? WHERE member_id = ?", target, source);
        jdbcTemplate.update("UPDATE street_memos SET member_id = ? WHERE member_id = ?", target, source);
        mergeAdminDongBookmarks(source, target);
        jdbcTemplate.update("""
                UPDATE member_checklist_preferences source
                LEFT JOIN member_checklist_preferences target
                    ON target.member_id = ? AND target.stage = source.stage
                SET source.member_id = ?
                WHERE source.member_id = ? AND target.member_id IS NULL
                """, target, target, source);
        jdbcTemplate.update("DELETE FROM member_checklist_preferences WHERE member_id = ?", source);
        jdbcTemplate.update("""
                UPDATE member_weather_locations source
                LEFT JOIN member_weather_locations target ON target.member_id = ?
                SET source.member_id = ?
                WHERE source.member_id = ? AND target.member_id IS NULL
                """, target, target, source);
        jdbcTemplate.update("""
                UPDATE member_notification_settings source
                LEFT JOIN member_notification_settings target ON target.member_id = ?
                SET source.member_id = ?
                WHERE source.member_id = ? AND target.member_id IS NULL
                """, target, target, source);
        jdbcTemplate.update("DELETE FROM member_weather_locations WHERE member_id = ?", source);
        jdbcTemplate.update("DELETE FROM member_notification_settings WHERE member_id = ?", source);
        jdbcTemplate.update("""
                UPDATE notification_devices SET token = NULL, token_hash = NULL, updated_at = ?
                WHERE member_id = ?
                """, mergedAt, source);
        jdbcTemplate.update("""
                UPDATE members SET merged_into_member_id = ?, updated_at = ? WHERE id = ?
                """, target, mergedAt, source);
    }

    // 같은 행정동을 두 회원이 모두 북마크했으면 대상 회원의 행 하나로 합친다. 원래 회원 쪽에만 살아 있으면 대상 쪽을 되살린다.
    private void mergeAdminDongBookmarks(final Long source, final Long target) {
        jdbcTemplate.update("""
                UPDATE admin_dong_bookmarks source
                LEFT JOIN admin_dong_bookmarks target
                    ON target.member_id = ? AND target.admin_dong_code = source.admin_dong_code
                SET source.member_id = ?
                WHERE source.member_id = ? AND target.id IS NULL
                """, target, target, source);
        jdbcTemplate.update("""
                UPDATE admin_dong_bookmarks target
                JOIN admin_dong_bookmarks source
                    ON source.member_id = ? AND source.admin_dong_code = target.admin_dong_code
                SET target.created_at = GREATEST(target.created_at, source.created_at), target.deleted_at = NULL
                WHERE target.member_id = ? AND source.deleted_at IS NULL
                """, source, target);
        jdbcTemplate.update("DELETE FROM admin_dong_bookmarks WHERE member_id = ?", source);
    }

    @Override
    public void deleteOwnedData(final Long memberId, final LocalDateTime deletedAt) {
        jdbcTemplate.update("""
                UPDATE property_photos
                SET deleted_at = ?
                WHERE member_id = ? AND deleted_at IS NULL
                """, deletedAt, memberId);
        jdbcTemplate.update("""
                UPDATE properties
                SET deleted_at = ?
                WHERE member_id = ? AND deleted_at IS NULL
                """, deletedAt, memberId);
        jdbcTemplate.update("""
                UPDATE user_checklists
                SET deleted_at = ?
                WHERE member_id = ? AND deleted_at IS NULL
                """, deletedAt, memberId);
        jdbcTemplate.update("""
                UPDATE street_memos
                SET updated_at = ?, deleted_at = ?
                WHERE member_id = ? AND deleted_at IS NULL
                """, deletedAt, deletedAt, memberId);
        jdbcTemplate.update("""
                UPDATE admin_dong_bookmarks
                SET deleted_at = ?
                WHERE member_id = ? AND deleted_at IS NULL
                """, deletedAt, memberId);
        jdbcTemplate.update("""
                UPDATE member_notification_settings
                SET enabled = FALSE, updated_at = ?
                WHERE member_id = ?
                """, deletedAt, memberId);
        jdbcTemplate.update("""
                UPDATE notification_devices
                SET token = NULL, token_hash = NULL, updated_at = ?
                WHERE member_id = ?
                """, deletedAt, memberId);
    }

    @Override
    public void delete(final Long memberId, final LocalDateTime deletedAt) {
        jdbcTemplate.update("""
                UPDATE members
                SET updated_at = ?, deleted_at = ?
                WHERE id = ? AND deleted_at IS NULL AND merged_into_member_id IS NULL
                """, deletedAt, deletedAt, memberId);
    }

    private RowMapper<Member> memberRowMapper() {
        return (resultSet, rowNumber) -> Member.reconstruct(
                resultSet.getLong("id"),
                resultSet.getTimestamp("created_at").toLocalDateTime(),
                resultSet.getTimestamp("updated_at").toLocalDateTime(),
                null
        );
    }
}
