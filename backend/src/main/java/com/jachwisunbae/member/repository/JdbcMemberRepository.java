package com.jachwisunbae.member.repository;

import com.jachwisunbae.member.entity.Member;
import java.sql.PreparedStatement;
import java.sql.Statement;
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
                WHERE id = ? AND deleted_at IS NULL
                """;
        return jdbcTemplate.query(sql, memberRowMapper(), memberId).stream().findFirst();
    }

    @Override
    public Optional<Member> findByIdForUpdate(final Long memberId) {
        String sql = """
                SELECT id, created_at, updated_at
                FROM members
                WHERE id = ? AND deleted_at IS NULL
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

    private RowMapper<Member> memberRowMapper() {
        return (resultSet, rowNumber) -> Member.reconstruct(
                resultSet.getLong("id"),
                resultSet.getTimestamp("created_at").toLocalDateTime(),
                resultSet.getTimestamp("updated_at").toLocalDateTime(),
                null
        );
    }
}
