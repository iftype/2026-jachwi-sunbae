package com.jachwisunbae.transit.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.jachwisunbae.transit.domain.GtfsEdge;
import com.jachwisunbae.transit.domain.GtfsFeed;
import com.jachwisunbae.transit.domain.GtfsRoute;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.GtfsTransfer;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import com.jachwisunbae.transit.domain.vo.Seconds;
import java.util.List;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class JdbcGtfsNetworkRepositoryTest {

    @Container
    // 운영과 같이 배치 저장을 여러 행 INSERT로 묶어 보내는 설정으로 검증한다.
    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.10")
            .withUrlParam("rewriteBatchedStatements", "true");

    private static JdbcTemplate jdbcTemplate;
    private static JdbcGtfsNetworkRepository repository;

    @BeforeAll
    static void setUp() {
        DataSource dataSource = new DriverManagerDataSource(
                MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword());
        new ResourceDatabasePopulator(new ClassPathResource("db/init/001-schema.sql")).execute(dataSource);
        jdbcTemplate = new JdbcTemplate(dataSource);
        repository = new JdbcGtfsNetworkRepository(jdbcTemplate);
    }

    @Test
    @DisplayName("기존 노선망을 지우고 새 GTFS 노선망으로 교체한다")
    void replacesExistingNetwork() {
        repository.replace(new GtfsFeed(
                List.of(new GtfsRoute("OLD", "구노선", "구노선", 3, new Seconds(300))),
                List.of(new GtfsStop("X", "옛정류장", new Coordinate(37.0, 127.0))),
                List.of(),
                List.of()));

        repository.replace(new GtfsFeed(
                List.of(new GtfsRoute("R1", "1호선", "서울 1호선", 1, new Seconds(240))),
                List.of(new GtfsStop("S1", "서울역", new Coordinate(37.5546788, 126.9706069)),
                        new GtfsStop("S2", "시청", new Coordinate(37.5657037, 126.9769554))),
                List.of(new GtfsEdge("R1", "S1", "S2", new Seconds(120))),
                List.of(new GtfsTransfer("S1", "S2", new Seconds(180)))));

        assertThat(jdbcTemplate.queryForList("SELECT route_id FROM gtfs_routes", String.class))
                .containsExactly("R1");
        assertThat(jdbcTemplate.queryForList("SELECT stop_id FROM gtfs_stops ORDER BY stop_id", String.class))
                .containsExactly("S1", "S2");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT latitude FROM gtfs_stops WHERE stop_id = 'S1'", Double.class))
                .isEqualTo(37.5546788);
        assertThat(jdbcTemplate.queryForObject("SELECT travel_seconds FROM gtfs_edges", Integer.class))
                .isEqualTo(120);
    }
}
