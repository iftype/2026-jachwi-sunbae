package com.jachwisunbae.transit.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.transit.domain.GtfsEdge;
import com.jachwisunbae.transit.domain.GtfsFeed;
import com.jachwisunbae.transit.domain.GtfsRoute;
import com.jachwisunbae.transit.domain.GtfsStop;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import com.jachwisunbae.transit.domain.vo.Seconds;
import com.jachwisunbae.transit.provider.gtfs.GtfsFeedReader;
import com.jachwisunbae.transit.repository.JdbcGtfsNetworkRepository;
import java.nio.file.Path;
import java.util.List;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

// 기존 노선망을 지운 뒤 저장이 실패해도 @Transactional로 롤백되어 이전 노선망이 남는지 실제 MySQL로 확인한다.
@Testcontainers
class GtfsImportServiceTransactionTest {

    @Container
    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.10")
            .withUrlParam("rewriteBatchedStatements", "true");

    private static final GtfsFeed EXISTING_FEED = new GtfsFeed(
            List.of(new GtfsRoute("OLD", "구노선", "구노선", 3, new Seconds(300))),
            List.of(new GtfsStop("X", "옛정류장", new Coordinate(37.0, 127.0))),
            List.of(),
            List.of());

    // 구간이 적재 대상이 아닌 정류장(NONE)을 가리켜, 기존 데이터를 지우고 노선·정류장을 저장한 뒤 외래 키 위반으로 실패한다.
    private static final GtfsFeed BROKEN_FEED = new GtfsFeed(
            List.of(new GtfsRoute("NEW", "신노선", "신노선", 1, new Seconds(300))),
            List.of(new GtfsStop("S1", "서울역", new Coordinate(37.55, 126.97))),
            List.of(new GtfsEdge("NEW", "S1", "NONE", new Seconds(120))),
            List.of());

    private static DataSource dataSource;
    private static JdbcTemplate jdbcTemplate;

    @TempDir
    Path directory;

    @BeforeAll
    static void setUp() {
        dataSource = new DriverManagerDataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword());
        new ResourceDatabasePopulator(new ClassPathResource("db/init/001-schema.sql")).execute(dataSource);
        jdbcTemplate = new JdbcTemplate(dataSource);
    }

    @Test
    @DisplayName("기존 노선망을 지운 뒤 저장이 실패하면 롤백되어 이전 노선망이 그대로 남는다")
    void keepsExistingNetworkWhenReplacementFails() {
        transactionalService(EXISTING_FEED).importFeed();

        assertThatThrownBy(() -> transactionalService(BROKEN_FEED).importFeed())
                .isInstanceOf(DataIntegrityViolationException.class);

        assertThat(jdbcTemplate.queryForList("SELECT route_id FROM gtfs_routes", String.class))
                .containsExactly("OLD");
        assertThat(jdbcTemplate.queryForList("SELECT stop_id FROM gtfs_stops", String.class))
                .containsExactly("X");
    }

    // 스프링 컨텍스트 없이 운영과 같은 @Transactional 프록시를 씌운다.
    private GtfsImportService transactionalService(final GtfsFeed feed) {
        GtfsImportService service = new GtfsImportService(directory.toString(), readerReturning(feed),
                new JdbcGtfsNetworkRepository(jdbcTemplate));
        ProxyFactory proxyFactory = new ProxyFactory(service);
        proxyFactory.setProxyTargetClass(true);
        proxyFactory.addAdvice(new TransactionInterceptor(new DataSourceTransactionManager(dataSource),
                new AnnotationTransactionAttributeSource()));
        return (GtfsImportService) proxyFactory.getProxy();
    }

    private GtfsFeedReader readerReturning(final GtfsFeed feed) {
        return new GtfsFeedReader() {
            @Override
            public GtfsFeed read(final Path feedDirectory) {
                return feed;
            }
        };
    }
}
