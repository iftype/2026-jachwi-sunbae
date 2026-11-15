package com.jachwisunbae.common.observability;

import static com.jachwisunbae.auth.web.JwtAuthenticationFilter.MEMBER_ID_ATTRIBUTE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jachwisunbae.auth.token.JwtTokenProvider;
import com.jachwisunbae.auth.web.JwtAuthenticationFilter;
import com.jachwisunbae.member.entity.Member;
import com.jachwisunbae.member.repository.MemberRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RequestLoggingFilterTest {

    private static final String ERROR_BODY = """
            {"code":"INVALID_REQUEST","message":"요청 값이 올바르지 않습니다.","errors":[{"field":"name","reason":"필수 값입니다."}]}""";

    private final RequestLoggingFilter filter = new RequestLoggingFilter();
    private final Logger logger = (Logger) LoggerFactory.getLogger(RequestLoggingFilter.class);
    private final ListAppender<ILoggingEvent> appender = new ListAppender<>() {
        @Override
        protected void append(ILoggingEvent event) {
            event.prepareForDeferredProcessing();
            super.append(event);
        }
    };

    @BeforeEach
    void attachAppender() {
        appender.start();
        logger.addAppender(appender);
    }

    @AfterEach
    void detachAppender() {
        logger.detachAppender(appender);
        appender.stop();
    }

    @ParameterizedTest
    @ValueSource(ints = {200, 400, 500})
    @DisplayName("JWT로 확인한 회원은 응답 상태와 관계없이 기존 요청 ID와 함께 완료 로그에 남는다")
    void logsAuthenticatedMember(int status) throws Exception {
        var provider = mock(JwtTokenProvider.class);
        var members = mock(MemberRepository.class);
        when(provider.parseMemberId("valid-token")).thenReturn(123L);
        when(members.findById(123L)).thenReturn(Optional.of(mock(Member.class)));
        var jwt = new JwtAuthenticationFilter(provider, members, new ObjectMapper());
        var request = jsonRequest("GET", "/api/properties", "");
        request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer valid-token");
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> jwt.doFilter(req, res, (authenticated, result) -> {
            assertThat(MDC.get("request_id")).isEqualTo(response.getHeader("X-Request-Id"));
            respond(status, "{}").doFilter(authenticated, result);
        }));

        assertThat(fields(onlyEvent())).containsEntry("member_id", 123L).containsEntry("status", status);
        assertThat(onlyEvent().getMDCPropertyMap()).containsEntry("request_id", response.getHeader("X-Request-Id"));
        assertThat(response.getHeader("X-Request-Id")).isNotBlank();
        assertThat(MDC.get("request_id")).isNull();
        appender.list.clear();
        filter.doFilter(jsonRequest("GET", "/api/auth/anonymous", ""), new MockHttpServletResponse(), respond(200, "{}"));
        assertThat(fields(onlyEvent())).doesNotContainKey("member_id");
    }

    @ParameterizedTest
    @CsvSource({"/api/properties,401", "/api/auth/anonymous,200", "/actuator/health,200", "/api/admin/summary,200"})
    @DisplayName("인증되지 않거나 인증을 거치지 않는 공개·관리자 요청에는 회원 ID를 추정하지 않는다")
    void omitsUnidentifiedMember(String path, int expectedStatus) throws Exception {
        var jwt = new JwtAuthenticationFilter(mock(JwtTokenProvider.class), mock(MemberRepository.class), new ObjectMapper());
        var request = jsonRequest("GET", path, "");
        request.addHeader("member_id", "123");
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> jwt.doFilter(req, res, respond(200, "{}")));

        assertThat(fields(onlyEvent())).containsEntry("status", expectedStatus).doesNotContainKey("member_id");
    }

    @Test
    @DisplayName("인증 후 예외가 전파되어도 회원 ID를 남기고 관리자 요청에서는 속성을 무시한다")
    void preservesMemberOnUnhandledFailureAndExcludesAdmin() throws Exception {
        var request = jsonRequest("GET", "/api/properties", "");
        assertThatThrownBy(() -> filter.doFilter(request, new MockHttpServletResponse(), (req, res) -> {
            req.setAttribute(MEMBER_ID_ATTRIBUTE, 123L);
            throw new IllegalStateException("failure");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(fields(onlyEvent())).containsEntry("member_id", 123L).containsEntry("status", 500);
        appender.list.clear();
        var admin = jsonRequest("GET", "/api/admin/summary", "");
        admin.setAttribute(MEMBER_ID_ATTRIBUTE, 123L);
        filter.doFilter(admin, new MockHttpServletResponse(), respond(200, "{}"));
        assertThat(fields(onlyEvent())).doesNotContainKey("member_id");
    }

    @Test
    @DisplayName("관리자 요청은 예외 원문에 비밀이 있어도 요청·응답 상세와 예외 원문을 남기지 않는다")
    void omitsAllSensitiveAdminFailureDetails() throws Exception {
        String secret = "test-only-admin-secret";
        MockHttpServletRequest request = jsonRequest("POST", "/api/admin/session", "{\"accessCode\":\"" + secret + "\"}");
        request.setQueryString("code=" + secret);
        request.addHeader(HttpHeaders.USER_AGENT, secret);
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertThatThrownBy(() -> filter.doFilter(request, response, (req, res) -> {
            req.getInputStream().readAllBytes();
            throw new IllegalStateException(secret);
        })).isInstanceOf(IllegalStateException.class);

        ILoggingEvent event = onlyEvent();
        assertThat(fields(event)).doesNotContainKeys("query_string", "request_headers", "request_body", "response_body");
        assertThat(event.getFormattedMessage()).doesNotContain(secret);
        assertThat(event.getThrowableProxy()).isNull();
        assertThat(fields(event)).containsEntry("status", 500);
    }

    @Test
    @DisplayName("성공한 요청은 쿼리 문자열, 헤더, 본문을 남기지 않고 응답 본문을 그대로 전달한다")
    void doesNotLogDetailsForSuccessfulRequest() throws Exception {
        MockHttpServletRequest request = jsonRequest("POST", "/api/properties", "{\"name\":\"신림역 원룸\"}");
        request.setQueryString("page=1");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, respond(201, "{\"id\":1}"));

        assertThat(response.getContentAsString()).isEqualTo("{\"id\":1}");
        assertThat(fields(onlyEvent())).doesNotContainKeys(
                "query_string", "request_headers", "request_body", "response_body");
    }

    @Test
    @DisplayName("실패한 요청은 쿼리 문자열 전문, 허용한 헤더, 요청·응답 본문을 남긴다")
    void logsDetailsForFailedRequest() throws Exception {
        MockHttpServletRequest request = jsonRequest("POST", "/api/weather/devices", """
                {"installationId":"3f1c","installationSecret":"secret-value","token":"fcm-token"}""");
        request.setQueryString("latitude=37.5145443&query=%EC%8B%A0%EB%A6%BC%EB%A1%9C");
        request.addHeader(HttpHeaders.USER_AGENT, "jachwi-app/1.0");
        request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer access-token");
        request.addHeader(HttpHeaders.COOKIE, "refresh_token=refresh-value");
        request.addHeader("X-Test-Push-Key", "push-key");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, respond(400, ERROR_BODY));

        ILoggingEvent event = onlyEvent();
        assertThat(event.getLevel()).isEqualTo(Level.INFO);
        Map<String, Object> fields = fields(event);
        assertThat(fields)
                .containsEntry("query_string", "latitude=37.5145443&query=신림로")
                .containsEntry("request_headers", Map.of(
                        "user-agent", "jachwi-app/1.0",
                        "content-type", MediaType.APPLICATION_JSON_VALUE))
                .containsEntry("request_body",
                        "{\"installationId\":\"3f1c\",\"installationSecret\":\"***\",\"token\":\"***\"}")
                .containsEntry("response_body", ERROR_BODY);
        assertThat(response.getContentAsString(StandardCharsets.UTF_8)).isEqualTo(ERROR_BODY);
        assertThat(event.getFormattedMessage() + fields).doesNotContain(
                "access-token", "refresh-value", "push-key", "secret-value", "fcm-token");
    }

    @Test
    @DisplayName("애플리케이션이 읽지 않은 요청 본문은 남기지 않는다")
    void omitsUnreadRequestBody() throws Exception {
        MockHttpServletRequest request = jsonRequest("POST", "/api/properties", "{\"name\":\"신림역 원룸\"}");

        filter.doFilter(request, new MockHttpServletResponse(), (req, res) -> {
            ((HttpServletResponse) res).setStatus(401);
        });

        assertThat(fields(onlyEvent())).doesNotContainKeys("request_body", "response_body");
    }

    @Test
    @DisplayName("캐시 한도보다 큰 요청 본문은 내용 대신 크기만 남긴다")
    void omitsRequestBodyLargerThanCacheLimit() throws Exception {
        String largeBody = "{\"name\":\"" + "a".repeat(20 * 1024) + "\"}";
        MockHttpServletRequest request = jsonRequest("POST", "/api/properties", largeBody);

        filter.doFilter(request, new MockHttpServletResponse(), respond(400, ERROR_BODY));

        assertThat((String) fields(onlyEvent()).get("request_body"))
                .startsWith("[omitted body larger than cache limit")
                .doesNotContain("aaaa");
    }

    @Test
    @DisplayName("처리되지 않은 예외로 실패해도 요청 정보를 남기고 예외를 그대로 던진다")
    void logsDetailsWhenExceptionEscapes() {
        MockHttpServletRequest request = jsonRequest("PATCH", "/api/properties/1", "{\"name\":\"원룸\"}");
        request.setQueryString("force=true");

        assertThatThrownBy(() -> filter.doFilter(request, new MockHttpServletResponse(), (req, res) -> {
            req.getInputStream().readAllBytes();
            throw new IllegalStateException("boom");
        })).isInstanceOf(IllegalStateException.class);

        ILoggingEvent event = onlyEvent();
        assertThat(event.getLevel()).isEqualTo(Level.ERROR);
        assertThat(fields(event))
                .containsEntry("status", 500)
                .containsEntry("query_string", "force=true")
                .containsEntry("request_body", "{\"name\":\"원룸\"}");
    }

    @Test
    @DisplayName("응답 본문을 모아 두지 않고 쓰는 즉시 실제 응답으로 흘려보낸다")
    void streamsResponseBodyWithoutBuffering() throws Exception {
        byte[] photo = new byte[100 * 1024];
        MockHttpServletResponse response = new MockHttpServletResponse();
        int[] writtenBeforeChainEnds = {-1};

        filter.doFilter(new MockHttpServletRequest("GET", "/api/properties/1/photos/1"), response, (req, res) -> {
            HttpServletResponse httpResponse = (HttpServletResponse) res;
            httpResponse.setStatus(200);
            httpResponse.setContentType(MediaType.IMAGE_JPEG_VALUE);
            httpResponse.getOutputStream().write(photo);
            // 필터가 끝나기 전에 이미 실제 응답에 써졌는지 본다. 모아 두는 방식이면 0이다.
            writtenBeforeChainEnds[0] = response.getContentAsByteArray().length;
        });

        assertThat(writtenBeforeChainEnds[0]).isEqualTo(photo.length);
        assertThat(response.getContentAsByteArray()).hasSize(photo.length);
        assertThat(fields(onlyEvent())).doesNotContainKey("response_body");
    }

    @Test
    @DisplayName("보관 한도보다 큰 실패 응답은 본문 대신 크기만 남긴다")
    void omitsResponseBodyLargerThanCaptureLimit() throws Exception {
        String largeBody = "{\"code\":\"FAIL\",\"message\":\"" + "a".repeat(20 * 1024) + "\"}";
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(jsonRequest("GET", "/api/properties", ""), response, respond(500, largeBody));

        int bodyBytes = largeBody.getBytes(StandardCharsets.UTF_8).length;
        assertThat(fields(onlyEvent()))
                .containsEntry("response_body", HttpBodyLogFormatter.omittedLargeBody(bodyBytes));
        assertThat(response.getContentAsString(StandardCharsets.UTF_8)).isEqualTo(largeBody);
    }

    private static MockHttpServletRequest jsonRequest(String method, String uri, String body) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, uri);
        request.setContentType(MediaType.APPLICATION_JSON_VALUE);
        request.addHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE);
        request.setContent(body.getBytes(StandardCharsets.UTF_8));
        return request;
    }

    // 애플리케이션처럼 요청 본문을 읽고 JSON 응답을 쓴다.
    private static FilterChain respond(int status, String body) {
        return (request, response) -> {
            request.getInputStream().readAllBytes();
            HttpServletResponse httpResponse = (HttpServletResponse) response;
            httpResponse.setStatus(status);
            httpResponse.setContentType(MediaType.APPLICATION_JSON_VALUE);
            httpResponse.setCharacterEncoding(StandardCharsets.UTF_8.name());
            httpResponse.getWriter().write(body);
        };
    }

    private ILoggingEvent onlyEvent() {
        assertThat(appender.list).hasSize(1);
        return appender.list.getFirst();
    }

    private static Map<String, Object> fields(ILoggingEvent event) {
        return event.getKeyValuePairs().stream()
                .collect(Collectors.toMap(pair -> pair.key, pair -> pair.value));
    }
}
