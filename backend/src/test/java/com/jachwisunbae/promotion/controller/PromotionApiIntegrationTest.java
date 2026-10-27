package com.jachwisunbae.promotion.controller;

import static com.jachwisunbae.promotion.support.PromotionProductsFixture.product;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jachwisunbae.auth.token.JwtTokenProvider;
import com.jachwisunbae.promotion.domain.ConvenienceBrand;
import com.jachwisunbae.promotion.provider.PromotionFetcher;
import com.jachwisunbae.promotion.repository.JdbcPromotionProductRepository;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PromotionApiIntegrationTest {

    private static final ConvenienceBrand BRAND = ConvenienceBrand.EMART24;

    @Container
    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.10");

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtTokenProvider tokens;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private JdbcPromotionProductRepository repository;
    @MockitoBean
    private PromotionFetcher fetcher;

    @DynamicPropertySource
    static void database(final DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
    }

    @BeforeEach
    void clearProducts() {
        jdbc.update("DELETE FROM promotion_products");
    }

    @AfterEach
    void doesNotCollectOnRead() {
        verifyNoInteractions(fetcher);
    }

    @Test
    @DisplayName("저장된 상품 전체를 저장 순서로 조회하고 수집 시각을 +09:00으로 반환한다")
    void returnsStoredProducts() throws Exception {
        repository.replaceByBrand(BRAND, List.of(product("먼저 저장한 상품"), product("다음 상품")),
                LocalDateTime.of(2026, 10, 27, 4, 2, 13, 123456000));

        mvc.perform(get("/api/promotions").param("brand", "EMART24").header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("SUCCESS"))
                .andExpect(jsonPath("$.data.brand").value("EMART24"))
                .andExpect(jsonPath("$.data.count").value(2))
                .andExpect(jsonPath("$.data.collectedAt").value("2026-10-27T04:02:13.123456+09:00"))
                .andExpect(jsonPath("$.data.products[0].name").value("먼저 저장한 상품"))
                .andExpect(jsonPath("$.data.products[0].price").value(3000))
                .andExpect(jsonPath("$.data.products[0].imageUrl").value("https://example.com/product.jpg"))
                .andExpect(jsonPath("$.data.products[0].category").value("MEAL"))
                .andExpect(jsonPath("$.data.products[0].promotionType").value("ONE_PLUS_ONE"))
                .andExpect(jsonPath("$.data.products[0].length()").value(5))
                .andExpect(jsonPath("$.data.products[1].name").value("다음 상품"));
    }

    @Test
    @DisplayName("미수집 브랜드는 빈 목록과 null 수집 시각을 반환한다")
    void returnsEmptyUncollectedBrand() throws Exception {
        mvc.perform(get("/api/promotions").param("brand", "EMART24").header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.count").value(0))
                .andExpect(jsonPath("$.data.products").isEmpty())
                .andExpect(jsonPath("$.data.collectedAt").value(nullValue()));
    }

    @ParameterizedTest
    @ValueSource(strings = {"UNKNOWN", "emart24", "CU", ""})
    @DisplayName("지원하지 않거나 비어 있는 브랜드는 400을 반환한다")
    void rejectsInvalidBrand(final String brand) throws Exception {
        mvc.perform(get("/api/promotions").param("brand", brand).header("Authorization", bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                .andExpect(jsonPath("$.errors[0].field").value("brand"));
    }

    @Test
    @DisplayName("브랜드가 없으면 400을 반환한다")
    void rejectsMissingBrand() throws Exception {
        mvc.perform(get("/api/promotions").header("Authorization", bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                .andExpect(jsonPath("$.errors[0].field").value("brand"));
    }

    @Test
    @DisplayName("JWT가 없으면 401을 반환한다")
    void requiresJwt() throws Exception {
        mvc.perform(get("/api/promotions").param("brand", "EMART24"))
                .andExpect(status().isUnauthorized());
    }

    private String bearer() {
        return "Bearer " + tokens.createAccessToken(1L);
    }
}
