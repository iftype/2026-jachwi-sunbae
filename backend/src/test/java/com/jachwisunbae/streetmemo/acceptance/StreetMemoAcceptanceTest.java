package com.jachwisunbae.streetmemo.acceptance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@ActiveProfiles("test")
@Tag("acceptance")
class StreetMemoAcceptanceTest {

    @Container
    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.10");

    @Autowired
    private MockMvc mvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbc;

    private MemberSession author;

    @DynamicPropertySource
    static void configureDatabase(final DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
    }

    @BeforeEach
    void setUp() throws Exception {
        jdbc.update("DELETE FROM street_memos");
        jdbc.update("DELETE FROM refresh_tokens");
        jdbc.update("DELETE FROM members");
        author = login();
    }

    @ParameterizedTest
    @ValueSource(strings = {"LIKE", "DISLIKE"})
    @DisplayName("매물이 없는 회원도 메모를 작성하고 다른 회원이 작성자 정보 없이 조회한다")
    void createsAndSharesWithoutAuthorInformation(final String preference) throws Exception {
        MemberSession reader = login();
        ObjectNode body = validBody().put("preference", preference)
                .put("memo", "  늦게까지 여는 세탁소예요. 🧺\n<script>alert('hi')</script>  ")
                .put("memberId", reader.memberId()).put("isMine", false);

        JsonNode created = create(author, body);
        long id = created.path("streetMemoId").asLong();
        assertPublicFields(created);
        assertThat(created.path("memo").asText()).isEqualTo(body.path("memo").asText());
        assertThat(created.path("preference").asText()).isEqualTo(preference);
        assertThat(jdbc.queryForObject("SELECT member_id FROM street_memos WHERE id = ?", Long.class, id))
                .isEqualTo(author.memberId());
        mvc.perform(viewport(author)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].isMine").value(true));

        JsonNode shared = data(mvc.perform(viewport(reader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("SUCCESS"))
                .andExpect(jsonPath("$.data.length()").value(1))
                .andReturn().getResponse().getContentAsString()).get(0);
        assertPublicFields(shared);
        ObjectNode expected = created.deepCopy();
        expected.put("isMine", false);
        assertThat(shared).isEqualTo(expected);
    }

    @Test
    @DisplayName("지도 영역의 경계를 포함하고 영역 밖과 삭제된 메모를 제외한다")
    void filtersViewportIncludingEdgesAndExcludingDeleted() throws Exception {
        MemberSession other = login();
        long first = create(author, validBody().put("latitude", 37).put("longitude", 126))
                .path("streetMemoId").asLong();
        long second = create(other, validBody().put("latitude", 38).put("longitude", 128))
                .path("streetMemoId").asLong();
        create(author, validBody().put("latitude", 36.9999999));
        create(author, validBody().put("latitude", 38.0000001));
        create(author, validBody().put("longitude", 125.9999999));
        create(author, validBody().put("longitude", 128.0000001));
        long deleted = create(author, validBody()).path("streetMemoId").asLong();
        mvc.perform(authorized(delete("/api/street-memos/{streetMemoId}", deleted), author))
                .andExpect(status().isNoContent());

        JsonNode items = data(mvc.perform(viewport(other))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        List<Long> ids = new ArrayList<>();
        items.forEach(item -> ids.add(item.path("streetMemoId").asLong()));
        assertThat(ids).containsExactlyInAnyOrder(first, second);
        items.forEach(item -> assertThat(item.path("isMine").booleanValue())
                .isEqualTo(item.path("streetMemoId").asLong() == second));
        mvc.perform(authorized(get("/api/street-memos"), other)
                        .param("minLatitude", "37").param("maxLatitude", "37")
                        .param("minLongitude", "126").param("maxLongitude", "126"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].streetMemoId").value(first));
    }

    @Test
    @DisplayName("본인의 메모만 본문 없이 삭제하고 반복·타인·미존재 삭제는 모두 404로 응답한다")
    void deletesOnlyOwnMemoAndKeepsSoftDeletedRow() throws Exception {
        long id = create(author, validBody()).path("streetMemoId").asLong();
        MemberSession other = login();
        mvc.perform(authorized(delete("/api/street-memos/{streetMemoId}", id), other))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("STREET_MEMO_NOT_FOUND"));
        assertThat(jdbc.queryForObject("SELECT deleted_at IS NULL FROM street_memos WHERE id = ?",
                Boolean.class, id)).isTrue();

        mvc.perform(authorized(delete("/api/street-memos/{streetMemoId}", id), author))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertThat(jdbc.queryForObject("""
                SELECT COUNT(*) FROM street_memos
                WHERE id = ? AND deleted_at IS NOT NULL AND updated_at = deleted_at
                """, Long.class, id)).isEqualTo(1L);
        assertThat(jdbc.queryForMap("SELECT memo, preference FROM street_memos WHERE id = ?", id))
                .containsEntry("memo", "세탁소가 있어요.").containsEntry("preference", "LIKE");
        mvc.perform(viewport(other)).andExpect(status().isOk()).andExpect(jsonPath("$.data").isEmpty());
        for (long missingId : new long[]{id, Long.MAX_VALUE}) {
            mvc.perform(authorized(delete("/api/street-memos/{streetMemoId}", missingId), author))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("STREET_MEMO_NOT_FOUND"));
        }
    }

    @Test
    @DisplayName("필수 작성 필드를 누락하면 저장 없이 각 필드의 검증 오류를 반환한다")
    void rejectsIncompleteRequest() throws Exception {
        mvc.perform(authorized(post("/api/street-memos"), author)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                .andExpect(jsonPath("$.errors[*].field").value(
                        containsInAnyOrder("latitude", "longitude", "memo", "preference")));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM street_memos", Long.class)).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "NEUTRAL", "like"})
    @DisplayName("대문자 LIKE와 DISLIKE 외의 선호값을 거부한다")
    void rejectsInvalidPreference(final String preference) throws Exception {
        assertInvalidCreate(validBody().put("preference", preference), "STREET_MEMO_PREFERENCE_INVALID");
    }

    @ParameterizedTest
    @CsvSource({"latitude, 90.0000001", "longitude, 180.0000001"})
    @DisplayName("허용 범위 밖의 작성 좌표를 거부한다")
    void rejectsInvalidLocation(final String field, final String value) throws Exception {
        assertInvalidCreate(validBody().put(field, value), "STREET_MEMO_LOCATION_INVALID");
    }

    @Test
    @DisplayName("조회 좌표가 누락되면 서비스의 영역 검증으로 거부한다")
    void rejectsMissingBounds() throws Exception {
        mvc.perform(authorized(get("/api/street-memos"), author)
                        .param("minLatitude", "37").param("maxLatitude", "38").param("minLongitude", "126"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("STREET_MEMO_QUERY_INVALID"));
    }

    @ParameterizedTest
    @CsvSource({"39,38,126,128", "37,38,126,181"})
    @DisplayName("조회 영역의 역순과 범위 오류를 거부한다")
    void rejectsInvalidBounds(final String minLat, final String maxLat,
                             final String minLon, final String maxLon) throws Exception {
        mvc.perform(authorized(get("/api/street-memos"), author)
                        .param("minLatitude", minLat).param("maxLatitude", maxLat)
                        .param("minLongitude", minLon).param("maxLongitude", maxLon))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("STREET_MEMO_QUERY_INVALID"));
    }

    @Test
    @DisplayName("작성·조회·삭제 모두 유효한 인증을 요구한다")
    void requiresAuthenticationForEveryEndpoint() throws Exception {
        long id = create(author, validBody()).path("streetMemoId").asLong();
        List<MockHttpServletRequestBuilder> requests = List.of(
                post("/api/street-memos").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validBody())),
                get("/api/street-memos"), delete("/api/street-memos/{streetMemoId}", id));
        for (MockHttpServletRequestBuilder request : requests) {
            mvc.perform(request)
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value("ACCESS_TOKEN_INVALID"));
            mvc.perform(request.header(HttpHeaders.AUTHORIZATION, "Bearer invalid"))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value("ACCESS_TOKEN_INVALID"));
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM street_memos WHERE deleted_at IS NULL", Long.class))
                .isEqualTo(1L);
        mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/street-memos'].post.security[0].bearerAuth").isArray())
                .andExpect(jsonPath("$.paths['/api/street-memos'].get.security[0].bearerAuth").isArray())
                .andExpect(jsonPath("$.paths['/api/street-memos/{streetMemoId}'].delete.security[0].bearerAuth").isArray());
    }

    @Test
    @DisplayName("탈퇴한 회원의 토큰으로 작성하거나 삭제할 수 없다")
    void rejectsWritesFromDeletedMember() throws Exception {
        long id = create(author, validBody()).path("streetMemoId").asLong();
        jdbc.update("UPDATE members SET deleted_at = CURRENT_TIMESTAMP(6) WHERE id = ?", author.memberId());
        mvc.perform(authorized(post("/api/street-memos"), author).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validBody())))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MEMBER_NOT_FOUND"));
        mvc.perform(authorized(delete("/api/street-memos/{streetMemoId}", id), author))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MEMBER_NOT_FOUND"));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM street_memos WHERE deleted_at IS NULL", Long.class))
                .isEqualTo(1L);
    }

    private MemberSession login() throws Exception {
        JsonNode data = data(mvc.perform(post("/api/auth/login"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        return new MemberSession(data.path("member").path("memberId").asLong(),
                data.path("accessToken").asText());
    }

    private ObjectNode validBody() {
        return objectMapper.createObjectNode().put("latitude", 37.5).put("longitude", 127.0)
                .put("memo", "세탁소가 있어요.").put("preference", "LIKE");
    }

    private JsonNode create(final MemberSession member, final ObjectNode body) throws Exception {
        var response = mvc.perform(authorized(post("/api/street-memos"), member)
                        .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.code").value("SUCCESS"))
                .andExpect(jsonPath("$.data.isMine").value(true))
                .andReturn().getResponse();
        JsonNode created = data(response.getContentAsString());
        assertThat(created.path("streetMemoId").asLong()).isPositive();
        assertThat(response.getHeader(HttpHeaders.LOCATION))
                .isEqualTo("/api/street-memos/" + created.path("streetMemoId").asLong());
        return created;
    }

    private void assertInvalidCreate(final ObjectNode body, final String errorCode) throws Exception {
        mvc.perform(authorized(post("/api/street-memos"), author).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value(errorCode));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM street_memos", Long.class)).isZero();
    }

    private MockHttpServletRequestBuilder viewport(final MemberSession member) {
        return authorized(get("/api/street-memos"), member)
                .param("minLatitude", "37").param("maxLatitude", "38")
                .param("minLongitude", "126").param("maxLongitude", "128");
    }

    private MockHttpServletRequestBuilder authorized(final MockHttpServletRequestBuilder request,
                                                     final MemberSession member) {
        return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + member.accessToken());
    }

    private JsonNode data(final String body) throws Exception {
        return objectMapper.readTree(body).path("data");
    }

    private void assertPublicFields(final JsonNode memo) {
        List<String> fields = new ArrayList<>();
        memo.fieldNames().forEachRemaining(fields::add);
        assertThat(fields).containsExactlyInAnyOrder("streetMemoId", "latitude", "longitude", "memo", "preference", "isMine");
    }

    private record MemberSession(long memberId, String accessToken) {
    }
}
