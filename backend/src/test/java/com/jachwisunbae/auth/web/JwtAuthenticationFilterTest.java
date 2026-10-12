package com.jachwisunbae.auth.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jachwisunbae.auth.token.JwtTokenProvider;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class JwtAuthenticationFilterTest {

    private static final String SECRET = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";

    private final JwtTokenProvider tokenProvider = new JwtTokenProvider(SECRET, "jachwi-sunbae", "jachwi-sunbae-api",
            43_200, Clock.fixed(Instant.parse("2026-09-28T00:00:00Z"), ZoneOffset.UTC));
    private final JwtAuthenticationFilter filter =
            new JwtAuthenticationFilter(tokenProvider, new ObjectMapper());

    @Test
    @DisplayName("올바른 토큰이면 회원 ID를 요청에 담아 다음 필터로 넘긴다")
    void passesRequestWithMemberIdWhenTokenIsValid() throws Exception {
        MockHttpServletRequest request = request("GET", "/api/properties");
        request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer " + tokenProvider.createAccessToken(7L));
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, new MockHttpServletResponse(), chain);

        assertThat(chain.getRequest()).isNotNull();
        assertThat(request.getAttribute(JwtAuthenticationFilter.MEMBER_ID_ATTRIBUTE)).isEqualTo(7L);
    }

    @Test
    @DisplayName("토큰이 없으면 401로 응답한다")
    void rejectsRequestWithoutToken() throws Exception {
        assertUnauthorized(request("GET", "/api/properties"));
    }

    @Test
    @DisplayName("Bearer 형식이 아니면 401로 응답한다")
    void rejectsNonBearerAuthorization() throws Exception {
        MockHttpServletRequest request = request("GET", "/api/properties");
        request.addHeader(HttpHeaders.AUTHORIZATION, "Basic dXNlcjpwYXNz");

        assertUnauthorized(request);
    }

    @Test
    @DisplayName("올바르지 않은 토큰이면 401로 응답한다")
    void rejectsInvalidToken() throws Exception {
        MockHttpServletRequest request = request("GET", "/api/properties");
        request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer not-a-jwt");

        assertUnauthorized(request);
    }

    @Test
    @DisplayName("로그인, 공개 조회, API가 아닌 경로, CORS 사전 요청은 토큰 없이 통과한다")
    void passesPublicRequestsWithoutToken() throws Exception {
        MockHttpServletRequest preflight = request("OPTIONS", "/api/properties");
        preflight.addHeader(HttpHeaders.ORIGIN, "http://localhost:3000");
        preflight.addHeader(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET");

        assertPassed(request("POST", "/api/auth/nickname"));
        assertPassed(request("GET", "/api/check-items"));
        assertPassed(request("GET", "/api/maps/geocode"));
        assertPassed(request("GET", "/api/guest/properties"));
        assertPassed(request("GET", "/api/guest/checklists"));
        assertPassed(request("GET", "/actuator/health"));
        assertPassed(preflight);
    }

    @Test
    @DisplayName("체크 항목도 조회가 아니면 토큰이 필요하다")
    void requiresTokenForNonGetCheckItems() throws Exception {
        assertUnauthorized(request("POST", "/api/check-items"));
    }

    @Test
    @DisplayName("게스트 API도 조회가 아니면 토큰이 필요하다")
    void requiresTokenForNonGetGuest() throws Exception {
        assertUnauthorized(request("POST", "/api/guest/properties"));
    }

    private void assertPassed(MockHttpServletRequest request) throws Exception {
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, new MockHttpServletResponse(), chain);

        assertThat(chain.getRequest()).isNotNull();
    }

    private void assertUnauthorized(MockHttpServletRequest request) throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(chain.getRequest()).isNull();
        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentAsString()).contains("\"code\":\"ACCESS_TOKEN_INVALID\"");
    }

    private static MockHttpServletRequest request(String method, String path) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setRequestURI(path);
        return request;
    }
}
