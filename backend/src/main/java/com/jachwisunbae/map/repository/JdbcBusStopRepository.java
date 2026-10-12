package com.jachwisunbae.map.repository;

import com.jachwisunbae.map.domain.BusStop;
import com.jachwisunbae.map.domain.CoordinateBounds;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcBusStopRepository implements BusStopRepository {

    private static final RowMapper<BusStop> BUS_STOP_ROW_MAPPER = (rs, row) -> BusStop.reconstruct(
            rs.getString("node_id"),
            rs.getString("name"),
            rs.getBigDecimal("latitude"),
            rs.getBigDecimal("longitude"),
            rs.getString("city_code")
    );

    private final JdbcTemplate jdbcTemplate;

    public JdbcBusStopRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    // 정류장 데이터는 원본 그대로 저장하고, 탈 수 없는 정류장은 이름 표기로 조회할 때 거른다.
    // - "(미정차)": 노선이 지나가지만 서지 않는 정류장
    // - "(가상…)", "가상정류장N": 노선 경로용 가상 지점. "가상리" 같은 실제 지명은 남기도록 괄호 표기와 접두어만 거른다.
    @Override
    public List<BusStop> findAllWithin(CoordinateBounds bounds) {
        String sql = """
                SELECT node_id, name, latitude, longitude, city_code
                FROM bus_stops
                WHERE latitude BETWEEN ? AND ?
                  AND longitude BETWEEN ? AND ?
                  AND name NOT LIKE '%(미정차)%'
                  AND name NOT LIKE '%(가상%'
                  AND name NOT LIKE '가상정류장%'
                """;
        return jdbcTemplate.query(sql, BUS_STOP_ROW_MAPPER,
                bounds.getMinLatitude(), bounds.getMaxLatitude(), bounds.getMinLongitude(), bounds.getMaxLongitude());
    }
}
