package com.jachwisunbae.promotion.repository;

import static com.jachwisunbae.promotion.support.PromotionProductsFixture.product;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.promotion.domain.ConvenienceBrand;
import com.jachwisunbae.promotion.domain.PromotionProduct;
import com.jachwisunbae.promotion.support.PromotionDatabaseTestConfiguration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.aop.support.AopUtils;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class JdbcPromotionProductRepositoryTest {

    private static final ConvenienceBrand BRAND = ConvenienceBrand.EMART24;
    private static final LocalDateTime FIRST_AT = LocalDateTime.of(2026, 10, 26, 4, 0, 0, 123456000);

    @Container
    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.10");

    private AnnotationConfigApplicationContext context;
    private JdbcPromotionProductRepository repository;
    private JdbcTemplate jdbcTemplate;

    @BeforeAll
    static void migrate() {
        Flyway.configure().dataSource(dataSource(false)).load().migrate();
    }

    @BeforeEach
    void setUp() {
        openContext(false);
        jdbcTemplate.update("DELETE FROM promotion_products");
    }

    @AfterEach
    void closeContext() {
        context.close();
    }

    @Test
    @DisplayName("여러 배치의 상품과 수집 시각을 저장하고 원래 순서로 읽는다")
    void insertsAcrossBatchesAndReadsProducts() {
        List<PromotionProduct> products = IntStream.range(0, 1005).mapToObj(index -> product("상품" + index)).toList();

        assertThat(repository.replaceByBrand(BRAND, products, FIRST_AT)).isZero();

        assertThat(repository.findByBrand(BRAND)).containsExactlyElementsOf(products);
        assertThat(repository.findLastCollectedAt(BRAND)).contains(FIRST_AT);
    }

    @Test
    @DisplayName("같은 목록을 반복 저장해도 누적되지 않고 새 목록으로 교체한다")
    void replacesRepeatedAndChangedSnapshots() {
        List<PromotionProduct> first = List.of(product("기존1"), product("기존2"));
        repository.replaceByBrand(BRAND, first, FIRST_AT);

        assertThat(repository.replaceByBrand(BRAND, first, FIRST_AT.plusDays(1))).isEqualTo(2);
        assertThat(repository.findByBrand(BRAND)).containsExactlyElementsOf(first);
        assertThat(repository.findLastCollectedAt(BRAND)).contains(FIRST_AT.plusDays(1));

        assertThat(repository.replaceByBrand(BRAND, List.of(product("신규")), FIRST_AT.plusDays(2))).isEqualTo(2);
        assertThat(repository.findByBrand(BRAND)).containsExactly(product("신규"));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    @DisplayName("DELETE와 첫 배치 이후 다음 배치가 실패하면 이전 행과 수집 시각을 롤백한다")
    void rollsBackDeleteAndSuccessfulBatchWhenLaterInsertFails(final boolean rewriteBatches) {
        context.close();
        openContext(rewriteBatches);
        repository.replaceByBrand(BRAND, List.of(product("이전 정상 상품")), FIRST_AT);
        List<Map<String, Object>> before = rows();
        List<PromotionProduct> invalid = new ArrayList<>(
                IntStream.range(0, 1000).mapToObj(index -> product("신규" + index)).toList());
        invalid.add(product("가".repeat(256))); // 첫 1000개 뒤의 두 번째 배치에서 VARCHAR(255) 제약 위반
        assertThat(AopUtils.isAopProxy(repository)).isTrue();

        assertThatThrownBy(() -> repository.replaceByBrand(BRAND, invalid, FIRST_AT.plusDays(1)))
                .isInstanceOf(DataIntegrityViolationException.class);

        assertThat(rows()).isEqualTo(before);
    }

    @Test
    @DisplayName("빈 목록으로는 기존 행을 지우지 않는다")
    void rejectsEmptyReplacement() {
        repository.replaceByBrand(BRAND, List.of(product("이전 상품")), FIRST_AT);

        assertThatThrownBy(() -> repository.replaceByBrand(BRAND, List.of(), FIRST_AT.plusDays(1)))
                .isInstanceOf(IllegalArgumentException.class);

        assertThat(repository.findByBrand(BRAND)).containsExactly(product("이전 상품"));
    }

    @Test
    @DisplayName("저장된 상품이 없으면 빈 목록과 빈 수집 시각을 반환한다")
    void returnsEmptyBeforeStoring() {
        assertThat(repository.findByBrand(BRAND)).isEmpty();
        assertThat(repository.findLastCollectedAt(BRAND)).isEmpty();
    }

    private List<Map<String, Object>> rows() {
        return jdbcTemplate.queryForList("SELECT * FROM promotion_products ORDER BY id");
    }

    private void openContext(final boolean rewriteBatches) {
        DataSource dataSource = dataSource(rewriteBatches);
        context = new AnnotationConfigApplicationContext();
        context.registerBean(DataSource.class, () -> dataSource);
        context.register(PromotionDatabaseTestConfiguration.class);
        context.refresh();
        repository = context.getBean(JdbcPromotionProductRepository.class);
        jdbcTemplate = context.getBean(JdbcTemplate.class);
    }

    private static DataSource dataSource(final boolean rewriteBatches) {
        String url = MYSQL.getJdbcUrl();
        return new DriverManagerDataSource(url + (url.contains("?") ? "&" : "?")
                + "rewriteBatchedStatements=" + rewriteBatches, MYSQL.getUsername(), MYSQL.getPassword());
    }
}
