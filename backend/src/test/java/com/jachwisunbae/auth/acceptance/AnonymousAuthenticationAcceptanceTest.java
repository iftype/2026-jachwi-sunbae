package com.jachwisunbae.auth.acceptance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jachwisunbae.auth.token.RefreshTokenProvider;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@ActiveProfiles("test")
@Tag("acceptance")
class AnonymousAuthenticationAcceptanceTest {

    @Container
    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.10");

    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private MockMvc mvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private RefreshTokenProvider refreshTokenProvider;

    @DynamicPropertySource
    static void configureDatabase(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
    }

    @BeforeEach
    void clearMembers() {
        jdbcTemplate.update("DELETE FROM refresh_tokens");
        jdbcTemplate.update("DELETE FROM members");
    }

    @Test
    @DisplayName("입력 없이 익명 로그인하고 발급받은 JWT로 내 정보를 조회한다")
    void startsAnonymouslyAndReadsOwnProfile() throws Exception {
        var login = mvc.perform(post("/api/auth/login"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("SUCCESS"))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.data.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.data.expiresIn").value(43_200))
                .andExpect(jsonPath("$.data.refreshToken").doesNotExist())
                .andExpect(jsonPath("$.data.refreshTokenExpiresIn").doesNotExist())
                .andExpect(jsonPath("$.data.newMember").value(true))
                .andExpect(jsonPath("$.data.member.memberId").isNumber())
                .andExpect(jsonPath("$.data.member.nickname").doesNotExist())
                .andExpect(jsonPath("$.data.member.passwordProtected").doesNotExist())
                .andReturn();
        JsonNode data = objectMapper.readTree(login.getResponse().getContentAsString()).path("data");
        long memberId = data.path("member").path("memberId").asLong();
        String token = data.path("accessToken").asText();

        Cookie refreshCookie = login.getResponse().getCookie("refresh_token");
        assertThat(refreshCookie).isNotNull();
        assertThat(refreshCookie.isHttpOnly()).isTrue();
        assertThat(refreshCookie.getSecure()).isTrue();
        assertThat(refreshCookie.getPath()).isEqualTo("/api/auth");
        assertThat(refreshCookie.getMaxAge()).isEqualTo(31_536_000);
        String tokenHash = refreshTokenProvider.hash(refreshCookie.getValue());

        mvc.perform(get("/api/members/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("SUCCESS"))
                .andExpect(jsonPath("$.data.id").value(memberId))
                .andExpect(jsonPath("$.data.nickname").doesNotExist())
                .andExpect(jsonPath("$.data.passwordProtected").doesNotExist());
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM members WHERE id = ? AND deleted_at IS NULL",
                Long.class, memberId)).isEqualTo(1L);
        assertThat(jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM refresh_tokens rt
                JOIN members m ON m.id = rt.member_id
                WHERE m.id = ? AND rt.created_at = m.created_at AND rt.token_hash = ?
                """, Long.class, memberId, tokenHash)).isEqualTo(1L);
    }

    @Test
    @DisplayName("JWT가 유효해도 탈퇴한 회원의 정보는 조회할 수 없다")
    void rejectsDeletedMemberWithValidToken() throws Exception {
        var login = mvc.perform(post("/api/auth/login"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode data = objectMapper.readTree(login.getResponse().getContentAsString()).path("data");
        long memberId = data.path("member").path("memberId").asLong();
        String token = data.path("accessToken").asText();
        jdbcTemplate.update("UPDATE members SET deleted_at = NOW(6) WHERE id = ?", memberId);

        mvc.perform(get("/api/members/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("MEMBER_NOT_FOUND"));
    }

    @Test
    @DisplayName("토큰이 없거나 올바르지 않으면 내 정보를 조회할 수 없다")
    void rejectsMissingOrInvalidToken() throws Exception {
        mvc.perform(get("/api/members/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("ACCESS_TOKEN_INVALID"));
        mvc.perform(get("/api/members/me").header(HttpHeaders.AUTHORIZATION, "Bearer not-a-jwt"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("ACCESS_TOKEN_INVALID"));
    }

    @Test
    @DisplayName("기존 닉네임 로그인 경로로는 회원을 생성할 수 없다")
    void noLongerSupportsNicknameLogin() throws Exception {
        mvc.perform(post("/api/auth/nickname"))
                .andExpect(status().isNotFound());

        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM members", Long.class)).isZero();
    }
}
