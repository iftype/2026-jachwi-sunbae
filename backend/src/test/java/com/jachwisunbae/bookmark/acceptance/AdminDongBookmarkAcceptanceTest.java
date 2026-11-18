package com.jachwisunbae.bookmark.acceptance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@ActiveProfiles("test")
@Tag("acceptance")
class AdminDongBookmarkAcceptanceTest {

    @Container
    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.10");

    private static final String SAJIK = "11010530";
    private static final String YEOKSAM = "11680640";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbc;

    private MemberSession member;

    @DynamicPropertySource
    static void configureDatabase(final DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
    }

    @BeforeEach
    void setUp() throws Exception {
        jdbc.update("DELETE FROM admin_dong_bookmarks");
        jdbc.update("DELETE FROM refresh_tokens");
        jdbc.update("DELETE FROM members");
        jdbc.update("DELETE FROM admin_dongs");
        insertAdminDong(SAJIK, "사직동");
        insertAdminDong(YEOKSAM, "역삼1동");
        member = login();
    }

    @Test
    @DisplayName("행정동을 북마크하면 201과 코드를 받고, 두 번 북마크해도 목록에는 한 번만 있다")
    void addsBookmarkIdempotently() throws Exception {
        add(member, SAJIK).andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.LOCATION, "/api/admin-dong-bookmarks/" + SAJIK))
                .andExpect(jsonPath("$.code").value("SUCCESS"))
                .andExpect(jsonPath("$.data.adminDongCode").value(SAJIK));
        add(member, SAJIK).andExpect(status().isCreated());

        assertThat(codes(member)).containsExactly(SAJIK);
    }

    @Test
    @DisplayName("최근에 북마크한 행정동부터 코드만 돌려주고, 다른 회원의 북마크는 보이지 않는다")
    void listsOnlyOwnCodesNewestFirst() throws Exception {
        MemberSession other = login();
        add(member, SAJIK).andExpect(status().isCreated());
        add(member, YEOKSAM).andExpect(status().isCreated());
        add(other, YEOKSAM).andExpect(status().isCreated());

        mvc.perform(authorized(get("/api/admin-dong-bookmarks"), member))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.adminDongCodes.length()").value(2))
                .andExpect(jsonPath("$.data.adminDongCodes[0]").value(YEOKSAM))
                .andExpect(jsonPath("$.data.adminDongCodes[1]").value(SAJIK));
        assertThat(codes(other)).containsExactly(YEOKSAM);
    }

    @Test
    @DisplayName("북마크가 없으면 빈 배열을 돌려준다")
    void listsEmptyBookmarks() throws Exception {
        assertThat(codes(member)).isEmpty();
    }

    @Test
    @DisplayName("해제하면 목록에서 빠지고, 다시 해제하거나 다른 회원이 해제하면 404다")
    void removesBookmark() throws Exception {
        MemberSession other = login();
        add(member, SAJIK).andExpect(status().isCreated());

        mvc.perform(authorized(delete("/api/admin-dong-bookmarks/{adminDongCode}", SAJIK), other))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ADMIN_DONG_BOOKMARK_NOT_FOUND"));
        mvc.perform(authorized(delete("/api/admin-dong-bookmarks/{adminDongCode}", SAJIK), member))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertThat(codes(member)).isEmpty();
        mvc.perform(authorized(delete("/api/admin-dong-bookmarks/{adminDongCode}", SAJIK), member))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ADMIN_DONG_BOOKMARK_NOT_FOUND"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"1101053", "110105300", "1101053a", "99999999"})
    @DisplayName("형식이 틀리거나 적재되지 않은 행정동은 저장하지 않는다")
    void rejectsInvalidCode(final String code) throws Exception {
        add(member, code).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ADMIN_DONG_BOOKMARK_INVALID"));

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM admin_dong_bookmarks", Long.class)).isZero();
    }

    @Test
    @DisplayName("행정동 코드가 없으면 저장하지 않는다")
    void rejectsMissingCode() throws Exception {
        mvc.perform(authorized(post("/api/admin-dong-bookmarks"), member)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM admin_dong_bookmarks", Long.class)).isZero();
    }

    @Test
    @DisplayName("인증 없이는 북마크를 추가, 조회, 해제할 수 없다")
    void requiresAuthentication() throws Exception {
        mvc.perform(post("/api/admin-dong-bookmarks").contentType(MediaType.APPLICATION_JSON)
                        .content(body(SAJIK)))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin-dong-bookmarks")).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/admin-dong-bookmarks/{adminDongCode}", SAJIK)).andExpect(status().isUnauthorized());

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM admin_dong_bookmarks", Long.class)).isZero();
    }

    private ResultActions add(final MemberSession session, final String code) throws Exception {
        return mvc.perform(authorized(post("/api/admin-dong-bookmarks"), session)
                .contentType(MediaType.APPLICATION_JSON).content(body(code)));
    }

    private String body(final String code) throws Exception {
        return objectMapper.writeValueAsString(objectMapper.createObjectNode().put("adminDongCode", code));
    }

    private List<String> codes(final MemberSession session) throws Exception {
        JsonNode data = data(mvc.perform(authorized(get("/api/admin-dong-bookmarks"), session))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        List<String> codes = new ArrayList<>();
        data.path("adminDongCodes").forEach(code -> codes.add(code.asText()));
        return codes;
    }

    private MemberSession login() throws Exception {
        JsonNode data = data(mvc.perform(post("/api/auth/login"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        return new MemberSession(data.path("member").path("memberId").asLong(), data.path("accessToken").asText());
    }

    private void insertAdminDong(final String code, final String name) {
        jdbc.update("""
                INSERT INTO admin_dongs (code, name, sido_name, sigungu_name, full_name,
                                         center_latitude, center_longitude, boundary, base_date)
                VALUES (?, ?, '서울특별시', '종로구', CONCAT('서울특별시 종로구 ', ?), 37.5475, 126.97,
                        '{"type":"Polygon","coordinates":[[[126.95,37.54],[126.99,37.54],[126.99,37.555],[126.95,37.555],[126.95,37.54]]]}',
                        '2025-06-30')
                """, code, name, name);
    }

    private MockHttpServletRequestBuilder authorized(final MockHttpServletRequestBuilder request,
                                                     final MemberSession session) {
        return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + session.accessToken());
    }

    private JsonNode data(final String body) throws Exception {
        return objectMapper.readTree(body).path("data");
    }

    private record MemberSession(long memberId, String accessToken) {
    }
}
