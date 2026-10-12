package com.jachwisunbae.map.repository.cctv;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;

import com.jachwisunbae.common.exception.server.DataInconsistencyException;
import com.jachwisunbae.map.domain.CoordinateBounds;
import com.jachwisunbae.map.domain.cctv.Cctv;
import com.jachwisunbae.map.domain.cctv.CctvPurpose;
import java.math.BigDecimal;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
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

// DECIMAL 좌표 비교, 설치목적 IN 조건, NULL 컬럼 복원은 MySQL 동작에 달려 있어 실제 MySQL로 검증한다.
@Testcontainers
class JdbcCctvRepositoryTest {

    @Container
    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.10");

    // 판교역 주변 약 1km 사각형
    private static final CoordinateBounds PANGYO = CoordinateBounds.of(
            new BigDecimal("37.3858000"), new BigDecimal("37.4038000"),
            new BigDecimal("127.1000000"), new BigDecimal("127.1226000"));

    private static final Set<CctvPurpose> ALL_PURPOSES = EnumSet.allOf(CctvPurpose.class);

    private static JdbcTemplate jdbcTemplate;
    private static JdbcCctvRepository cctvRepository;

    @BeforeAll
    static void setUpSchema() {
        DataSource dataSource = new DriverManagerDataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(),
                MYSQL.getPassword());
        new ResourceDatabasePopulator(new ClassPathResource("db/init/001-schema.sql")).execute(dataSource);
        jdbcTemplate = new JdbcTemplate(dataSource);
        cctvRepository = new JdbcCctvRepository(jdbcTemplate);
    }

    @BeforeEach
    void clearCctvs() {
        jdbcTemplate.update("DELETE FROM cctvs");
    }

    @Test
    @DisplayName("사각형 안의 CCTV를 조회하고 CCTV 정보를 그대로 옮긴다")
    void findsCctvsWithinBounds() {
        insert("멀리있는CCTV", "생활방범", "37.4064167", "127.0882833");
        jdbcTemplate.update("""
                INSERT INTO cctvs (management_number, address, purpose, camera_count, camera_pixels, retention_days,
                    latitude, longitude)
                VALUES ('202630000000800991', '경기도 성남시 분당구 판교역로 166', '어린이보호', 3, 200, 30,
                    37.3948000, 127.1112000)
                """);

        List<Cctv> cctvs = cctvRepository.findAllWithin(PANGYO, ALL_PURPOSES);

        assertThat(cctvs)
                .extracting(Cctv::getManagementNumber, Cctv::getAddress, Cctv::getPurpose, Cctv::getCameraCount,
                        Cctv::getCameraPixels, Cctv::getRetentionDays, Cctv::getLatitude, Cctv::getLongitude)
                .containsExactly(tuple("202630000000800991", "경기도 성남시 분당구 판교역로 166",
                        CctvPurpose.CHILD_PROTECTION, 3, 200, 30,
                        new BigDecimal("37.3948000"), new BigDecimal("127.1112000")));
        assertThat(cctvs.get(0).getId()).isNotNull();
    }

    @Test
    @DisplayName("위도나 경도 중 하나라도 사각형을 벗어나면 조회하지 않는다")
    void excludesCctvsOutsideBounds() {
        insert("위도 초과", "생활방범", "37.4038001", "127.1112000");
        insert("위도 미달", "생활방범", "37.3857999", "127.1112000");
        insert("경도 초과", "생활방범", "37.3948000", "127.1226001");
        insert("경도 미달", "생활방범", "37.3948000", "127.0999999");

        assertThat(cctvRepository.findAllWithin(PANGYO, ALL_PURPOSES)).isEmpty();
    }

    @Test
    @DisplayName("사각형 경계 위의 CCTV는 포함한다")
    void includesCctvsOnBoundary() {
        insert("남서쪽 모서리", "생활방범", "37.3858000", "127.1000000");
        insert("북동쪽 모서리", "생활방범", "37.4038000", "127.1226000");

        assertThat(cctvRepository.findAllWithin(PANGYO, ALL_PURPOSES))
                .extracting(Cctv::getManagementNumber)
                .containsExactlyInAnyOrder("남서쪽 모서리", "북동쪽 모서리");
    }

    @Test
    @DisplayName("요청한 설치목적의 CCTV만 조회한다")
    void findsOnlyRequestedPurposes() {
        insert("생활방범", "생활방범", "37.3948000", "127.1112000");
        insert("어린이보호", "어린이보호", "37.3948000", "127.1112000");
        insert("쓰레기단속", "쓰레기단속", "37.3948000", "127.1112000");

        List<Cctv> cctvs = cctvRepository.findAllWithin(PANGYO,
                EnumSet.of(CctvPurpose.CRIME_PREVENTION, CctvPurpose.CHILD_PROTECTION));

        assertThat(cctvs)
                .extracting(Cctv::getManagementNumber)
                .containsExactlyInAnyOrder("생활방범", "어린이보호");
    }

    @Test
    @DisplayName("설치목적이 비어 있으면 조회하지 않는다")
    void returnsEmptyWhenNoPurpose() {
        insert("생활방범", "생활방범", "37.3948000", "127.1112000");

        assertThat(cctvRepository.findAllWithin(PANGYO, Set.of())).isEmpty();
    }

    @Test
    @DisplayName("같은 좌표의 CCTV를 모두 조회한다")
    void findsCctvsAtSameCoordinate() {
        insert("첫번째", "생활방범", "37.3948000", "127.1112000");
        insert("두번째", "생활방범", "37.3948000", "127.1112000");

        assertThat(cctvRepository.findAllWithin(PANGYO, ALL_PURPOSES)).hasSize(2);
    }

    @Test
    @DisplayName("화소수와 보관일수가 비어 있는 CCTV도 조회한다")
    void findsCctvsWithNullableValues() {
        insert("정보없음", "생활방범", "37.3948000", "127.1112000");

        List<Cctv> cctvs = cctvRepository.findAllWithin(PANGYO, ALL_PURPOSES);

        assertThat(cctvs).singleElement().satisfies(cctv -> {
            assertThat(cctv.getCameraPixels()).isNull();
            assertThat(cctv.getRetentionDays()).isNull();
        });
    }

    @Test
    @DisplayName("목록에 없는 설치목적으로 저장된 CCTV는 어떤 설치목적으로도 조회되지 않는다")
    void excludesUnknownPurpose() {
        insert("알수없음", "방범", "37.3948000", "127.1112000");

        assertThat(cctvRepository.findAllWithin(PANGYO, ALL_PURPOSES)).isEmpty();
    }

    @Test
    @DisplayName("저장된 값이 CCTV 규칙을 만족하지 않으면 서버 데이터 문제로 처리한다")
    void rejectsInconsistentData() {
        insert(" ", "생활방범", "37.3948000", "127.1112000");

        assertThatThrownBy(() -> cctvRepository.findAllWithin(PANGYO, ALL_PURPOSES))
                .isInstanceOf(DataInconsistencyException.class)
                .hasCauseInstanceOf(IllegalArgumentException.class);
    }

    private void insert(String managementNumber, String purpose, String latitude, String longitude) {
        jdbcTemplate.update("""
                INSERT INTO cctvs (management_number, address, purpose, camera_count, latitude, longitude)
                VALUES (?, '경기도 성남시 분당구 판교역로 166', ?, 1, ?, ?)
                """, managementNumber, purpose, new BigDecimal(latitude), new BigDecimal(longitude));
    }
}
