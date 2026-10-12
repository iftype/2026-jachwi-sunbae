package com.jachwisunbae.map.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import com.jachwisunbae.map.domain.BusStop;
import com.jachwisunbae.map.domain.CoordinateBounds;
import java.math.BigDecimal;
import java.util.List;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

// 이름 제외 조건(LIKE)과 DECIMAL 좌표 비교는 MySQL 동작에 달려 있어 실제 MySQL로 검증한다.
@Testcontainers
class JdbcBusStopRepositoryTest {

    @Container
    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.10");

    // 판교역 주변 약 1km 사각형
    private static final CoordinateBounds PANGYO = CoordinateBounds.of(
            new BigDecimal("37.3858000"), new BigDecimal("37.4038000"),
            new BigDecimal("127.1000000"), new BigDecimal("127.1226000"));

    private static JdbcTemplate jdbcTemplate;
    private static JdbcBusStopRepository busStopRepository;

    @BeforeAll
    static void setUpSchema() {
        DataSource dataSource = new DriverManagerDataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(),
                MYSQL.getPassword());
        new ResourceDatabasePopulator(new ClassPathResource("db/init/001-schema.sql")).execute(dataSource);
        jdbcTemplate = new JdbcTemplate(dataSource);
        busStopRepository = new JdbcBusStopRepository(jdbcTemplate);
    }

    @BeforeEach
    void clearBusStops() {
        jdbcTemplate.update("DELETE FROM bus_stops");
    }

    @Test
    @DisplayName("사각형 안의 정류장을 조회하고 정류장 정보를 그대로 옮긴다")
    void findsBusStopsWithinBounds() {
        insert("GGB204000159", "벤처타운(북문)", "37.4064167", "127.0882833");
        insert("GGB206000001", "판교역", "37.3948000", "127.1112000");

        List<BusStop> busStops = busStopRepository.findAllWithin(PANGYO);

        assertThat(busStops)
                .extracting(BusStop::getNodeId, BusStop::getName, BusStop::getLatitude, BusStop::getLongitude,
                        BusStop::getCityCode)
                .containsExactly(tuple("GGB206000001", "판교역", new BigDecimal("37.3948000"),
                        new BigDecimal("127.1112000"), "31020"));
    }

    @Test
    @DisplayName("위도나 경도 중 하나라도 사각형을 벗어나면 조회하지 않는다")
    void excludesBusStopsOutsideBounds() {
        insert("NORTH", "위도 초과", "37.4038001", "127.1112000");
        insert("SOUTH", "위도 미달", "37.3857999", "127.1112000");
        insert("EAST", "경도 초과", "37.3948000", "127.1226001");
        insert("WEST", "경도 미달", "37.3948000", "127.0999999");

        assertThat(busStopRepository.findAllWithin(PANGYO)).isEmpty();
    }

    @Test
    @DisplayName("사각형 경계 위의 정류장은 포함한다")
    void includesBusStopsOnBoundary() {
        insert("CORNER_MIN", "남서쪽 모서리", "37.3858000", "127.1000000");
        insert("CORNER_MAX", "북동쪽 모서리", "37.4038000", "127.1226000");

        assertThat(busStopRepository.findAllWithin(PANGYO))
                .extracting(BusStop::getNodeId)
                .containsExactlyInAnyOrder("CORNER_MIN", "CORNER_MAX");
    }

    @Test
    @DisplayName("미정차 정류장과 가상 정류장은 제외하고 가상리 같은 실제 지명은 남긴다")
    void excludesStopsPassengersCannotUse() {
        insert("NON_STOP", "구파발(미정차)", "37.3948000", "127.1112000");
        insert("VIRTUAL_SUFFIX", "홍대입구역(가상)", "37.3948000", "127.1112000");
        insert("VIRTUAL_PREFIX", "(가상)양산JC", "37.3948000", "127.1112000");
        insert("VIRTUAL_DETAIL", "신사동(가상정류소)", "37.3948000", "127.1112000");
        insert("VIRTUAL_NUMBERED", "가상정류장1", "37.3948000", "127.1112000");
        insert("VILLAGE", "가상리창고", "37.3948000", "127.1112000");

        assertThat(busStopRepository.findAllWithin(PANGYO))
                .extracting(BusStop::getNodeId)
                .containsExactly("VILLAGE");
    }

    private void insert(String nodeId, String name, String latitude, String longitude) {
        jdbcTemplate.update("""
                INSERT INTO bus_stops (node_id, name, latitude, longitude, city_code, city_name)
                VALUES (?, ?, ?, ?, '31020', '경기도 성남시')
                """, nodeId, name, new BigDecimal(latitude), new BigDecimal(longitude));
    }
}
