package com.jachwisunbae.auth.acceptance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jachwisunbae.auth.domain.RefreshToken;
import com.jachwisunbae.auth.repository.RefreshTokenRepository;
import com.jachwisunbae.auth.token.RefreshTokenProvider;
import com.nimbusds.jwt.SignedJWT;
import jakarta.servlet.http.Cookie;
import java.time.LocalDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
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
    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

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
                .andExpect(jsonPath("$.data.expiresIn").value(900))
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
        var claims = SignedJWT.parse(token).getJWTClaimsSet();
        assertThat(claims.getExpirationTime().getTime() - claims.getIssueTime().getTime())
                .isEqualTo(900_000L);

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

    @ParameterizedTest
    @ValueSource(strings = {"/api/auth/login", "/api/auth/refresh"})
    @DisplayName("유효한 쿠키로 기존 회원의 인증을 복원하고 같은 토큰의 만료일을 연장한다")
    void restoresExistingMemberAndExtendsExpiry(String path) throws Exception {
        AnonymousLogin original = startAnonymous();
        RefreshToken originalToken = storedToken(original);
        LocalDateTime shortenedExpiry = originalToken.getCreatedAt().plusDays(1);
        jdbcTemplate.update("UPDATE refresh_tokens SET expires_at = ? WHERE member_id = ?",
                shortenedExpiry, original.memberId());

        var result = mvc.perform(post(path).cookie(original.refreshCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.newMember").value(false))
                .andExpect(jsonPath("$.data.member.memberId").value(original.memberId()))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.data.refreshToken").doesNotExist())
                .andReturn();

        Cookie renewedCookie = result.getResponse().getCookie("refresh_token");
        assertThat(renewedCookie).isNotNull();
        assertThat(renewedCookie.getValue()).isEqualTo(original.refreshCookie().getValue());
        assertThat(renewedCookie.getMaxAge()).isEqualTo(31_536_000);
        RefreshToken renewed = storedToken(original);
        assertThat(renewed.getId()).isEqualTo(originalToken.getId());
        assertThat(renewed.getCreatedAt()).isEqualTo(originalToken.getCreatedAt());
        assertThat(renewed.getExpiresAt()).isAfter(shortenedExpiry)
                .isEqualTo(renewed.getUpdatedAt().plusDays(365));
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM members", Long.class)).isEqualTo(1L);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM refresh_tokens", Long.class)).isEqualTo(1L);

        String accessToken = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("accessToken").asText();
        mvc.perform(get("/api/members/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(original.memberId()));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "not-registered"})
    @DisplayName("로그인할 때 비어 있거나 등록되지 않은 쿠키가 오면 새 회원을 만든다")
    void startsNewMemberForUnknownCookie(String rawToken) throws Exception {
        mvc.perform(post("/api/auth/login").cookie(new Cookie("refresh_token", rawToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.newMember").value(true));

        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM members", Long.class)).isEqualTo(1L);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM refresh_tokens", Long.class)).isEqualTo(1L);
    }

    @ParameterizedTest
    @ValueSource(strings = {"expired", "deleted", "deleted-member"})
    @DisplayName("로그인할 때 인증을 복원할 수 없으면 이전 회원을 보존하고 새 회원을 만든다")
    void startsNewMemberWhenRestorationFails(String state) throws Exception {
        AnonymousLogin original = startAnonymous();
        invalidateAuthentication(original, state);

        var result = mvc.perform(post("/api/auth/login").cookie(original.refreshCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.newMember").value(true))
                .andReturn();

        long newMemberId = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("member").path("memberId").asLong();
        assertThat(newMemberId).isNotEqualTo(original.memberId());
        Cookie newCookie = result.getResponse().getCookie("refresh_token");
        assertThat(newCookie).isNotNull();
        assertThat(newCookie.getValue()).isNotEqualTo(original.refreshCookie().getValue());
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM members", Long.class)).isEqualTo(2L);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM members WHERE id = ?",
                Long.class, original.memberId())).isEqualTo(1L);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "not-registered"})
    @DisplayName("갱신 요청의 쿠키가 없거나 등록되지 않았으면 새 회원을 만들지 않고 401을 응답한다")
    void rejectsRefreshWithoutRegisteredToken(String rawToken) throws Exception {
        var request = post("/api/auth/refresh");
        if (rawToken != null) {
            request.cookie(new Cookie("refresh_token", rawToken));
        }

        mvc.perform(request)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("REFRESH_TOKEN_INVALID"));

        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM members", Long.class)).isZero();
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM refresh_tokens", Long.class)).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"expired", "deleted", "deleted-member"})
    @DisplayName("갱신할 인증이 유효하지 않으면 401을 응답하고 다른 회원으로 전환하지 않는다")
    void rejectsRefreshOfInvalidAuthentication(String state) throws Exception {
        AnonymousLogin original = startAnonymous();
        invalidateAuthentication(original, state);

        mvc.perform(post("/api/auth/refresh").cookie(original.refreshCookie()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("REFRESH_TOKEN_INVALID"));

        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM members", Long.class)).isEqualTo(1L);
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/auth/login", "/api/auth/refresh"})
    @DisplayName("저장된 토큰 데이터가 손상되면 인증 실패나 신규 회원 생성으로 숨기지 않고 500을 응답한다")
    void reportsStoredDataFailureAsServerError(String path) throws Exception {
        AnonymousLogin original = startAnonymous();
        jdbcTemplate.update("UPDATE refresh_tokens SET expires_at = updated_at WHERE member_id = ?",
                original.memberId());

        mvc.perform(post(path).cookie(original.refreshCookie()))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_SERVER_ERROR"));

        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM members", Long.class)).isEqualTo(1L);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM refresh_tokens", Long.class)).isEqualTo(1L);
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

    @ParameterizedTest
    @ValueSource(strings = {
            "/api/check-items",
            "/api/rental-transactions",
            "/api/commute-areas",
            "/api/commute-areas/route",
            "/api/maps/bus-stops",
            "/api/guest/properties"
    })
    @DisplayName("업무 조회 API도 Access Token 없이는 이용할 수 없다")
    void rejectsBusinessReadWithoutAccessToken(String path) throws Exception {
        mvc.perform(get(path))
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

    private AnonymousLogin startAnonymous() throws Exception {
        var result = mvc.perform(post("/api/auth/login"))
                .andExpect(status().isOk())
                .andReturn();
        long memberId = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("member").path("memberId").asLong();
        Cookie refreshCookie = result.getResponse().getCookie("refresh_token");
        assertThat(refreshCookie).isNotNull();
        return new AnonymousLogin(memberId, refreshCookie);
    }

    private RefreshToken storedToken(AnonymousLogin login) {
        return refreshTokenRepository.findByTokenHash(refreshTokenProvider.hash(login.refreshCookie().getValue()))
                .orElseThrow();
    }

    private void invalidateAuthentication(AnonymousLogin login, String state) {
        switch (state) {
            case "expired" -> {
                LocalDateTime issuedAt = storedToken(login).getCreatedAt();
                jdbcTemplate.update("""
                        UPDATE refresh_tokens
                        SET created_at = ?, updated_at = ?, expires_at = ?
                        WHERE member_id = ?
                        """, issuedAt.minusDays(400), issuedAt.minusDays(366), issuedAt.minusDays(1), login.memberId());
            }
            case "deleted" -> refreshTokenRepository.deleteByMemberId(login.memberId());
            case "deleted-member" -> jdbcTemplate.update("UPDATE members SET deleted_at = NOW(6) WHERE id = ?",
                    login.memberId());
            default -> throw new IllegalArgumentException("알 수 없는 테스트 인증 상태입니다.");
        }
    }

    private record AnonymousLogin(long memberId, Cookie refreshCookie) {
    }
}
