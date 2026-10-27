package com.jachwisunbae.streetmemo.repository;

import com.jachwisunbae.common.exception.client.ClientException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.DataInconsistencyException;
import com.jachwisunbae.streetmemo.domain.StreetMemo;
import com.jachwisunbae.streetmemo.domain.StreetMemoPreference;
import java.math.BigDecimal;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcStreetMemoRepository implements StreetMemoRepository {

    private static final RowMapper<StreetMemo> ROW_MAPPER = (resultSet, rowNumber) -> {
        Timestamp deletedAt = resultSet.getTimestamp("deleted_at");
        try {
            return StreetMemo.reconstruct(resultSet.getLong("id"),
                    resultSet.getLong("member_id"),
                    resultSet.getBigDecimal("latitude"),
                    resultSet.getBigDecimal("longitude"),
                    resultSet.getString("memo"),
                    StreetMemoPreference.fromCode(resultSet.getString("preference")),
                    resultSet.getTimestamp("created_at").toLocalDateTime(),
                    resultSet.getTimestamp("updated_at").toLocalDateTime(),
                    deletedAt == null ? null : deletedAt.toLocalDateTime());
        } catch (ClientException | IllegalArgumentException exception) {
            throw new DataInconsistencyException(ErrorCode.INTERNAL_SERVER_ERROR,
                    "저장된 거리 메모가 도메인 규칙을 만족하지 않습니다.", exception);
        }
    };

    private final JdbcTemplate jdbcTemplate;

    public JdbcStreetMemoRepository(final JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public StreetMemo save(final StreetMemo streetMemo) {
        if (streetMemo.getId() != null || streetMemo.isDeleted()) {
            throw new IllegalArgumentException("새 거리 메모만 저장할 수 있습니다.");
        }
        String sql = """
                INSERT INTO street_memos (member_id, latitude, longitude, memo, preference, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """;
        GeneratedKeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            statement.setLong(1, streetMemo.getMemberId());
            statement.setBigDecimal(2, streetMemo.getLatitude());
            statement.setBigDecimal(3, streetMemo.getLongitude());
            statement.setString(4, streetMemo.getMemo());
            statement.setString(5, streetMemo.getPreference().name());
            statement.setObject(6, streetMemo.getCreatedAt());
            statement.setObject(7, streetMemo.getUpdatedAt());
            return statement;
        }, keyHolder);
        Number key = keyHolder.getKey();
        if (key == null) {
            throw new IllegalStateException("거리 메모 저장 후 생성된 ID를 확인할 수 없습니다.");
        }
        return jdbcTemplate.queryForObject("""
                SELECT id, member_id, latitude, longitude, memo, preference, created_at, updated_at, deleted_at
                FROM street_memos WHERE id = ?
                """, ROW_MAPPER, key.longValue());
    }

    @Override
    public List<StreetMemo> findAllWithin(final BigDecimal minLatitude, final BigDecimal maxLatitude,
                                         final BigDecimal minLongitude, final BigDecimal maxLongitude) {
        return jdbcTemplate.query("""
                        SELECT id, member_id, latitude, longitude, memo, preference, created_at, updated_at, deleted_at
                        FROM street_memos
                        WHERE deleted_at IS NULL
                          AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?
                        """, ROW_MAPPER, minLatitude, maxLatitude, minLongitude, maxLongitude);
    }

    @Override
    public Optional<StreetMemo> findByIdForUpdate(final long id) {
        return jdbcTemplate.query("""
                SELECT id, member_id, latitude, longitude, memo, preference, created_at, updated_at, deleted_at
                FROM street_memos
                WHERE id = ? AND deleted_at IS NULL
                FOR UPDATE
                """, ROW_MAPPER, id).stream().findFirst();
    }

    @Override
    public int delete(final StreetMemo streetMemo) {
        if (streetMemo.getId() == null || !streetMemo.isDeleted()) {
            throw new IllegalArgumentException("삭제 상태로 변경한 저장된 거리 메모가 필요합니다.");
        }
        return jdbcTemplate.update("""
                        UPDATE street_memos SET updated_at = ?, deleted_at = ?
                        WHERE id = ? AND member_id = ? AND deleted_at IS NULL
                        """, streetMemo.getUpdatedAt(), streetMemo.getDeletedAt(), streetMemo.getId(),
                streetMemo.getMemberId());
    }
}
