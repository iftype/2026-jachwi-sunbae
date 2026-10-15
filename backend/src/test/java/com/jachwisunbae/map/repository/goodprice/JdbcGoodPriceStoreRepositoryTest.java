package com.jachwisunbae.map.repository.goodprice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;

import com.jachwisunbae.common.exception.server.DataInconsistencyException;
import com.jachwisunbae.map.domain.CoordinateBounds;
import com.jachwisunbae.map.domain.goodprice.GoodPriceMenu;
import com.jachwisunbae.map.domain.goodprice.GoodPriceStore;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

// DECIMAL 좌표 비교와 NULL 컬럼 복원은 MySQL 동작에 달려 있어 실제 MySQL로 검증한다.
@Testcontainers
class JdbcGoodPriceStoreRepositoryTest {

    @Container
    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.10");

    // 판교역 주변 약 1km 사각형
    private static final CoordinateBounds PANGYO = CoordinateBounds.of(
            new BigDecimal("37.3858000"), new BigDecimal("37.4038000"),
            new BigDecimal("127.1000000"), new BigDecimal("127.1226000"));

    private static JdbcTemplate jdbcTemplate;
    private static JdbcGoodPriceStoreRepository goodPriceStoreRepository;

    @BeforeAll
    static void setUpSchema() {
        DataSource dataSource = new DriverManagerDataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(),
                MYSQL.getPassword());
        Flyway.configure().dataSource(dataSource).load().migrate();
        jdbcTemplate = new JdbcTemplate(dataSource);
        goodPriceStoreRepository = new JdbcGoodPriceStoreRepository(jdbcTemplate);
    }

    @BeforeEach
    void clearStores() {
        jdbcTemplate.update("DELETE FROM good_price_stores");
    }

    @Test
    @DisplayName("사각형 안의 업소를 조회하고 업소 정보를 그대로 옮긴다")
    void findsStoresWithinBounds() {
        insert("멀리있는식당", "37.4064167", "127.0882833");
        jdbcTemplate.update("""
                INSERT INTO good_price_stores (province, district, business_type, name, phone, address,
                    latitude, longitude, menu_name_1, menu_price_1, menu_name_2, menu_price_2, source_date)
                VALUES ('경기도', '성남시', '이용업', '좋은이발소', '031-123-4567', '경기도 성남시 분당구 판교역로 1',
                    37.3948000, 127.1112000, '커트', '일반: 10000원/ 노인: 8000원', '파마', '25000~45000', '2026-06-30')
                """);

        List<GoodPriceStore> stores = goodPriceStoreRepository.findAllWithin(PANGYO);

        assertThat(stores)
                .extracting(GoodPriceStore::getProvince, GoodPriceStore::getDistrict, GoodPriceStore::getBusinessType,
                        GoodPriceStore::getName, GoodPriceStore::getPhone, GoodPriceStore::getAddress,
                        GoodPriceStore::getLatitude, GoodPriceStore::getLongitude, GoodPriceStore::getSourceDate)
                .containsExactly(tuple("경기도", "성남시", "이용업", "좋은이발소", "031-123-4567",
                        "경기도 성남시 분당구 판교역로 1", new BigDecimal("37.3948000"), new BigDecimal("127.1112000"),
                        LocalDate.of(2026, 6, 30)));
        assertThat(stores.get(0).getId()).isNotNull();
        assertThat(stores.get(0).getMenus()).containsExactly(
                new GoodPriceMenu("커트", "일반: 10000원/ 노인: 8000원"),
                new GoodPriceMenu("파마", "25000~45000"));
    }

    @Test
    @DisplayName("위도나 경도 중 하나라도 사각형을 벗어나면 조회하지 않는다")
    void excludesStoresOutsideBounds() {
        insert("위도 초과", "37.4038001", "127.1112000");
        insert("위도 미달", "37.3857999", "127.1112000");
        insert("경도 초과", "37.3948000", "127.1226001");
        insert("경도 미달", "37.3948000", "127.0999999");

        assertThat(goodPriceStoreRepository.findAllWithin(PANGYO)).isEmpty();
    }

    @Test
    @DisplayName("사각형 경계 위의 업소는 포함한다")
    void includesStoresOnBoundary() {
        insert("남서쪽 모서리", "37.3858000", "127.1000000");
        insert("북동쪽 모서리", "37.4038000", "127.1226000");

        assertThat(goodPriceStoreRepository.findAllWithin(PANGYO))
                .extracting(GoodPriceStore::getName)
                .containsExactlyInAnyOrder("남서쪽 모서리", "북동쪽 모서리");
    }

    @Test
    @DisplayName("시군, 연락처, 메뉴가 비어 있는 업소도 조회한다")
    void findsStoresWithNullableValues() {
        jdbcTemplate.update("""
                INSERT INTO good_price_stores (province, business_type, name, address, latitude, longitude,
                    menu_name_1, menu_price_1, menu_name_2, menu_price_2, menu_price_3, source_date)
                VALUES ('세종특별자치시', '한식', '좋은식당', '세종특별자치시 한누리대로 1', 37.3948000, 127.1112000,
                    '김치찌개', NULL, NULL, NULL, '9000', '2026-06-30')
                """);

        List<GoodPriceStore> stores = goodPriceStoreRepository.findAllWithin(PANGYO);

        assertThat(stores).singleElement().satisfies(store -> {
            assertThat(store.getDistrict()).isNull();
            assertThat(store.getPhone()).isNull();
            assertThat(store.getMenus()).containsExactly(new GoodPriceMenu("김치찌개", null));
        });
    }

    @Test
    @DisplayName("저장된 값이 업소 규칙을 만족하지 않으면 서버 데이터 문제로 처리한다")
    void rejectsInconsistentData() {
        insert(" ", "37.3948000", "127.1112000");

        assertThatThrownBy(() -> goodPriceStoreRepository.findAllWithin(PANGYO))
                .isInstanceOf(DataInconsistencyException.class)
                .hasCauseInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("조회 범위와 관계없이 적재된 업소의 기준일을 조회한다")
    void findsLatestSourceDate() {
        insert("멀리있는식당", "35.1795543", "129.0756416");

        assertThat(goodPriceStoreRepository.findLatestSourceDate()).contains(LocalDate.of(2026, 6, 30));
    }

    @Test
    @DisplayName("기준일이 섞여 있으면 가장 최근 기준일을 조회한다")
    void findsMostRecentSourceDate() {
        insert("이전식당", "37.3948000", "127.1112000");
        jdbcTemplate.update("UPDATE good_price_stores SET source_date = '2026-03-31'");
        insert("최근식당", "37.3948000", "127.1112000");

        assertThat(goodPriceStoreRepository.findLatestSourceDate()).contains(LocalDate.of(2026, 6, 30));
    }

    @Test
    @DisplayName("적재된 업소가 없으면 기준일이 없다")
    void findsNoSourceDateWhenEmpty() {
        assertThat(goodPriceStoreRepository.findLatestSourceDate()).isEmpty();
    }

    private void insert(String name, String latitude, String longitude) {
        jdbcTemplate.update("""
                INSERT INTO good_price_stores (province, business_type, name, address, latitude, longitude,
                    source_date)
                VALUES ('경기도', '한식', ?, '경기도 성남시 분당구 판교역로 1', ?, ?, '2026-06-30')
                """, name, new BigDecimal(latitude), new BigDecimal(longitude));
    }
}
