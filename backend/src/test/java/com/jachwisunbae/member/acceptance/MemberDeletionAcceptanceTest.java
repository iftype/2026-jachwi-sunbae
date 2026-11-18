package com.jachwisunbae.member.acceptance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jachwisunbae.auth.domain.RefreshToken;
import com.jachwisunbae.auth.repository.RefreshTokenRepository;
import com.jachwisunbae.auth.token.JwtTokenProvider;
import jakarta.servlet.http.Cookie;
import java.time.LocalDateTime;
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
class MemberDeletionAcceptanceTest {

    @Container
    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.10");

    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private MockMvc mvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private RefreshTokenRepository refreshTokens;
    @Autowired
    private JwtTokenProvider tokenProvider;

    @DynamicPropertySource
    static void configureDatabase(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
    }

    @BeforeEach
    void clearData() {
        jdbc.update("DELETE FROM notification_devices");
        jdbc.update("DELETE FROM member_notification_settings");
        jdbc.update("DELETE FROM street_memos");
        jdbc.update("DELETE FROM admin_dong_bookmarks");
        jdbc.update("DELETE FROM property_photos");
        jdbc.update("DELETE FROM properties");
        jdbc.update("DELETE FROM user_checklists");
        jdbc.update("DELETE FROM refresh_tokens");
        jdbc.update("DELETE FROM members");
    }

    @Test
    @DisplayName("탈퇴하면 소유 기록을 논리 삭제하고 Refresh 쿠키와 기존 Access Token을 무효화한다")
    void deletesMemberDataAndAuthentication() throws Exception {
        var login = mvc.perform(post("/api/auth/login"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode loginData = objectMapper.readTree(login.getResponse().getContentAsString()).path("data");
        long memberId = loginData.path("member").path("memberId").asLong();
        String accessToken = loginData.path("accessToken").asText();
        Cookie refreshCookie = login.getResponse().getCookie("refresh_token");
        assertThat(refreshCookie).isNotNull();
        String anotherRawToken = tokenProvider.generateOpaqueToken();
        LocalDateTime issuedAt = refreshTokens.findByTokenHash(tokenProvider.hashOpaqueToken(refreshCookie.getValue()))
                .orElseThrow().getCreatedAt();
        refreshTokens.save(RefreshToken.create(memberId, tokenProvider.hashOpaqueToken(anotherRawToken), issuedAt, 365));

        LocalDateTime now = LocalDateTime.now();
        jdbc.update("INSERT INTO properties (member_id, name, created_at) VALUES (?, '내 매물', ?)", memberId, now);
        long propertyId = jdbc.queryForObject("SELECT id FROM properties WHERE member_id = ?", Long.class, memberId);
        jdbc.update("""
                INSERT INTO property_photos (property_id, member_id, storage_key, content_type, size_bytes, created_at)
                VALUES (?, ?, 'deleted-member/photo.jpg', 'image/jpeg', 10, ?)
                """, propertyId, memberId, now);
        jdbc.update("""
                INSERT INTO user_checklists (member_id, name, stage, created_at)
                VALUES (?, '내 체크리스트', 'ON_SITE', ?)
                """, memberId, now);
        jdbc.update("""
                INSERT INTO street_memos (member_id, latitude, longitude, memo, preference, created_at, updated_at)
                VALUES (?, 37.5, 127.0, '내 거리 메모', 'LIKE', ?, ?)
                """, memberId, now, now);
        jdbc.update("""
                INSERT INTO admin_dong_bookmarks (member_id, admin_dong_code, created_at)
                VALUES (?, '11680640', ?)
                """, memberId, now);
        jdbc.update("""
                INSERT INTO member_notification_settings (member_id, enabled, updated_at)
                VALUES (?, TRUE, ?)
                """, memberId, now);
        jdbc.update("""
                INSERT INTO notification_devices
                    (installation_id, member_id, installation_secret_hash, token, token_hash, updated_at)
                VALUES ('00000000-0000-0000-0000-000000000001', ?, REPEAT('a', 64), 'push-token', REPEAT('b', 64), ?)
                """, memberId, now);

        var deletion = mvc.perform(delete("/api/members/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNoContent())
                .andReturn();

        Cookie clearedCookie = deletion.getResponse().getCookie("refresh_token");
        assertThat(clearedCookie).isNotNull();
        assertThat(clearedCookie.getValue()).isEmpty();
        assertThat(clearedCookie.getMaxAge()).isZero();
        assertThat(clearedCookie.getPath()).isEqualTo("/api/auth");
        assertThat(clearedCookie.isHttpOnly()).isTrue();
        assertThat(clearedCookie.getSecure()).isTrue();
        assertThat(deletion.getResponse().getHeader(HttpHeaders.SET_COOKIE)).contains("SameSite=Lax");

        assertThat(jdbc.queryForObject("SELECT deleted_at IS NOT NULL FROM members WHERE id = ?",
                Boolean.class, memberId)).isTrue();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM refresh_tokens WHERE member_id = ?",
                Long.class, memberId)).isZero();
        for (String table : new String[]{"properties", "property_photos", "user_checklists", "street_memos",
                "admin_dong_bookmarks"}) {
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM " + table + " WHERE member_id = ? AND deleted_at IS NULL",
                    Long.class, memberId)).isZero();
        }
        assertThat(jdbc.queryForObject("SELECT enabled FROM member_notification_settings WHERE member_id = ?",
                Boolean.class, memberId)).isFalse();
        assertThat(jdbc.queryForObject("SELECT token FROM notification_devices WHERE member_id = ?",
                String.class, memberId)).isNull();

        mvc.perform(get("/api/members/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("ACCESS_TOKEN_INVALID"));
        mvc.perform(post("/api/auth/refresh").cookie(refreshCookie))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("REFRESH_TOKEN_INVALID"));
        mvc.perform(post("/api/auth/refresh").cookie(new Cookie("refresh_token", anotherRawToken)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("REFRESH_TOKEN_INVALID"));
        mvc.perform(post("/api/auth/login").cookie(refreshCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.newMember").value(true));
    }

    @Test
    @DisplayName("Access Token이 없으면 탈퇴 요청을 거절한다")
    void requiresAccessToken() throws Exception {
        mvc.perform(delete("/api/members/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("ACCESS_TOKEN_INVALID"));
    }
}
