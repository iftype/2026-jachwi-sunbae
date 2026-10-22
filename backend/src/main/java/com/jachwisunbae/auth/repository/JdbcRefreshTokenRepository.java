package com.jachwisunbae.auth.repository;

import com.jachwisunbae.auth.domain.RefreshToken;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcRefreshTokenRepository implements RefreshTokenRepository {

    private static final RowMapper<RefreshToken> tokenRowMapper = (resultSet, rowNumber) -> RefreshToken.reconstruct(
            resultSet.getLong("id"),
            resultSet.getLong("member_id"),
            resultSet.getString("token_hash"),
            resultSet.getTimestamp("created_at").toLocalDateTime(),
            resultSet.getTimestamp("updated_at").toLocalDateTime(),
            resultSet.getTimestamp("expires_at").toLocalDateTime()
    );

    private final JdbcTemplate jdbcTemplate;

    public JdbcRefreshTokenRepository(final JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public RefreshToken save(final RefreshToken refreshToken) {
        String sql = """
                INSERT INTO refresh_tokens (member_id, token_hash, created_at, updated_at, expires_at)
                VALUES (?, ?, ?, ?, ?)
                """;

        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            statement.setLong(1, refreshToken.getMemberId());
            statement.setString(2, refreshToken.getTokenHash());
            statement.setObject(3, refreshToken.getCreatedAt());
            statement.setObject(4, refreshToken.getUpdatedAt());
            statement.setObject(5, refreshToken.getExpiresAt());
            return statement;
        }, keyHolder);

        Number key = keyHolder.getKey();
        if (key == null) {
            throw new IllegalStateException("Refresh Token 저장 후 생성된 ID를 확인할 수 없습니다.");
        }
        return RefreshToken.reconstruct(key.longValue(), refreshToken.getMemberId(), refreshToken.getTokenHash(),
                refreshToken.getCreatedAt(), refreshToken.getUpdatedAt(), refreshToken.getExpiresAt());
    }

    @Override
    public Optional<RefreshToken> findByTokenHash(final String tokenHash) {
        String sql = """
                SELECT id, member_id, token_hash, created_at, updated_at, expires_at
                FROM refresh_tokens
                WHERE token_hash = ?
                """;
        return jdbcTemplate.query(sql, tokenRowMapper, tokenHash).stream().findFirst();
    }

    @Override
    public int updateExpiry(final RefreshToken refreshToken) {
        String sql = """
                UPDATE refresh_tokens
                SET updated_at = ?, expires_at = ?
                WHERE id = ? AND member_id = ? AND token_hash = ?
                """;
        return jdbcTemplate.update(sql, refreshToken.getUpdatedAt(), refreshToken.getExpiresAt(),
                refreshToken.getId(), refreshToken.getMemberId(), refreshToken.getTokenHash());
    }

    @Override
    public void deleteByMemberId(final Long memberId) {
        String sql = """
                DELETE FROM refresh_tokens
                WHERE member_id = ?
                """;
        jdbcTemplate.update(sql, memberId);
    }
}
