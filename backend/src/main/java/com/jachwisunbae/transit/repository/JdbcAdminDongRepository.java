package com.jachwisunbae.transit.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.DataInconsistencyException;
import com.jachwisunbae.transit.domain.AdminDong;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import com.jachwisunbae.transit.provider.geojson.GeoJsonBoundaries;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcAdminDongRepository implements AdminDongRepository {

    // 경계 GeoJSON이 행마다 수 KB~수백 KB라, 여러 행 INSERT 한 번이 max_allowed_packet을 넘지 않도록 작게 묶는다.
    private static final int BATCH_SIZE = 100;

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public JdbcAdminDongRepository(final JdbcTemplate jdbcTemplate, final ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    public void replace(final List<AdminDong> adminDongs) {
        jdbcTemplate.update("DELETE FROM admin_dongs");
        String sql = """
                INSERT INTO admin_dongs (code, name, sido_name, sigungu_name, full_name,
                                         center_latitude, center_longitude, boundary, base_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """;
        jdbcTemplate.batchUpdate(sql, adminDongs, BATCH_SIZE, (statement, adminDong) -> {
            Coordinate center = adminDong.center();
            statement.setString(1, adminDong.code());
            statement.setString(2, adminDong.name());
            statement.setString(3, adminDong.sidoName());
            statement.setString(4, adminDong.sigunguName());
            statement.setString(5, adminDong.fullName());
            statement.setDouble(6, center.latitude());
            statement.setDouble(7, center.longitude());
            statement.setString(8, adminDong.boundary().geoJson());
            statement.setDate(9, Date.valueOf(adminDong.baseDate()));
        });
    }

    @Override
    public List<AdminDong> findAll() {
        return jdbcTemplate.query("""
                SELECT code, name, sido_name, sigungu_name, full_name, boundary, base_date
                FROM admin_dongs
                ORDER BY code
                """, (resultSet, rowNumber) -> toAdminDong(resultSet));
    }

    @Override
    public List<AdminDong> findByCodes(final Collection<String> codes) {
        if (codes.isEmpty()) {
            return List.of();
        }
        String placeholders = String.join(", ", Collections.nCopies(codes.size(), "?"));
        return jdbcTemplate.query("""
                SELECT code, name, sido_name, sigungu_name, full_name, boundary, base_date
                FROM admin_dongs
                WHERE code IN (%s)
                ORDER BY code
                """.formatted(placeholders), (resultSet, rowNumber) -> toAdminDong(resultSet), codes.toArray());
    }

    private AdminDong toAdminDong(final ResultSet resultSet) throws SQLException {
        String code = resultSet.getString("code");
        try {
            return new AdminDong(code, resultSet.getString("name"), resultSet.getString("sido_name"),
                    resultSet.getString("sigungu_name"), resultSet.getString("full_name"),
                    resultSet.getDate("base_date").toLocalDate(),
                    GeoJsonBoundaries.toBoundary(objectMapper.readTree(resultSet.getString("boundary"))));
        } catch (JsonProcessingException | IllegalArgumentException exception) {
            throw new DataInconsistencyException(ErrorCode.ADMIN_DONG_READ_FAILURE,
                    "저장된 행정동 경계를 읽지 못했습니다. code=" + code, exception);
        }
    }
}
