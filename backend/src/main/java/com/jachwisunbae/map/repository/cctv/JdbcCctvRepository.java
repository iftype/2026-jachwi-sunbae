package com.jachwisunbae.map.repository.cctv;

import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.DataInconsistencyException;
import com.jachwisunbae.map.domain.CoordinateBounds;
import com.jachwisunbae.map.domain.cctv.Cctv;
import com.jachwisunbae.map.domain.cctv.CctvPurpose;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcCctvRepository implements CctvRepository {

    private final JdbcTemplate jdbcTemplate;

    public JdbcCctvRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    // DB에는 설치목적 원본 문자열이 저장되어 있으므로 원본 문자열로 비교한다.
    // 그래서 목록에 없는 설치목적으로 저장된 행은 조회되지 않는다.
    @Override
    public List<Cctv> findAllWithin(CoordinateBounds bounds, Set<CctvPurpose> purposes) {
        if (purposes.isEmpty()) {
            return List.of();
        }
        String sql = """
                SELECT id, management_number, address, purpose, camera_count, camera_pixels, retention_days,
                       latitude, longitude
                FROM cctvs
                WHERE latitude BETWEEN ? AND ?
                  AND longitude BETWEEN ? AND ?
                  AND purpose IN (%s)
                """.formatted(String.join(", ", Collections.nCopies(purposes.size(), "?")));
        List<Object> parameters = new ArrayList<>(List.of(
                bounds.getMinLatitude(), bounds.getMaxLatitude(), bounds.getMinLongitude(), bounds.getMaxLongitude()));
        purposes.forEach(purpose -> parameters.add(purpose.getSourceName()));
        return jdbcTemplate.query(sql, cctvRowMapper(), parameters.toArray());
    }

    // DB에 저장된 값이 CCTV 규칙(필수 값, 카메라 대수, 좌표 범위)을 만족하지 않는 것은 적재 데이터 문제다.
    private RowMapper<Cctv> cctvRowMapper() {
        return (resultSet, rowNumber) -> {
            long id = resultSet.getLong("id");
            try {
                return Cctv.reconstruct(
                        id,
                        resultSet.getString("management_number"),
                        resultSet.getString("address"),
                        CctvPurpose.fromSourceName(resultSet.getString("purpose")),
                        resultSet.getInt("camera_count"),
                        nullableInt(resultSet, "camera_pixels"),
                        nullableInt(resultSet, "retention_days"),
                        resultSet.getBigDecimal("latitude"),
                        resultSet.getBigDecimal("longitude")
                );
            } catch (IllegalArgumentException exception) {
                throw new DataInconsistencyException(ErrorCode.INTERNAL_SERVER_ERROR,
                        "cctvId=" + id + " 저장된 CCTV 데이터가 CCTV 규칙을 만족하지 않습니다.", exception);
            }
        };
    }

    private Integer nullableInt(ResultSet resultSet, String column) throws SQLException {
        return resultSet.getObject(column, Integer.class);
    }
}
