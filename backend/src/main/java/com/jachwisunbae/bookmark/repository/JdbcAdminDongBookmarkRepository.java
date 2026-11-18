package com.jachwisunbae.bookmark.repository;

import java.time.LocalDateTime;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcAdminDongBookmarkRepository implements AdminDongBookmarkRepository {

    private final JdbcTemplate jdbcTemplate;

    public JdbcAdminDongBookmarkRepository(final JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    // 이미 북마크했으면 그대로 두고, 해제한 북마크면 같은 행을 되살려 새로 추가한 시각을 기록한다.
    @Override
    public void add(final long memberId, final String adminDongCode, final LocalDateTime createdAt) {
        jdbcTemplate.update("""
                INSERT INTO admin_dong_bookmarks (member_id, admin_dong_code, created_at)
                VALUES (?, ?, ?) AS new
                ON DUPLICATE KEY UPDATE
                    created_at = IF(admin_dong_bookmarks.deleted_at IS NULL,
                                    admin_dong_bookmarks.created_at, new.created_at),
                    deleted_at = NULL
                """, memberId, adminDongCode, createdAt);
    }

    @Override
    public int remove(final long memberId, final String adminDongCode, final LocalDateTime deletedAt) {
        return jdbcTemplate.update("""
                UPDATE admin_dong_bookmarks
                SET deleted_at = ?
                WHERE member_id = ? AND admin_dong_code = ? AND deleted_at IS NULL
                """, deletedAt, memberId, adminDongCode);
    }

    @Override
    public List<String> findCodesByMemberId(final long memberId) {
        return jdbcTemplate.queryForList("""
                SELECT admin_dong_code
                FROM admin_dong_bookmarks
                WHERE member_id = ? AND deleted_at IS NULL
                ORDER BY created_at DESC, id DESC
                """, String.class, memberId);
    }
}
