package com.jachwisunbae.promotion.provider.emart24;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.UpstreamServiceException;
import java.net.SocketTimeoutException;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class Emart24PromotionClientTest {

    private static final Emart24ProductCategory CATEGORY = Emart24ProductCategory.MEAL;
    private static final String URL = "https://emart24.co.kr/goods/event";

    private MockRestServiceServer server;
    private Emart24PromotionClient client;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl(Emart24PromotionClient.BASE_URL);
        server = MockRestServiceServer.bindTo(builder).build();
        client = new Emart24PromotionClient(builder.build());
    }

    @AfterEach
    void verifyRequests() {
        server.verify();
    }

    @Test
    @DisplayName("페이지마다 카테고리 필터를 유지하고 전체 혜택의 HTML만 요청한다")
    void requestsCategoryPage() {
        server.expect(requestTo(URL + "?page=2&base_category_seq=1"))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header(HttpHeaders.ACCEPT, MediaType.TEXT_HTML_VALUE))
                .andExpect(queryParam("page", "2"))
                .andExpect(queryParam("base_category_seq", "1"))
                .andRespond(withSuccess("<html>행사상품</html>", MediaType.TEXT_HTML));

        assertThat(client.fetch(CATEGORY, 2)).isEqualTo("<html>행사상품</html>");
    }

    @ParameterizedTest
    @ValueSource(ints = {204, 301, 302, 403, 429, 500, 503})
    @DisplayName("접근 제한·리다이렉트를 포함한 200 외의 상태에서 재시도 없이 실패한다")
    void rejectsHttpErrors(final int status) {
        server.expect(requestTo(Matchers.startsWith(URL)))
                .andRespond(withStatus(HttpStatusCode.valueOf(status)));

        assertThatThrownBy(() -> client.fetch(CATEGORY, 1))
                .isInstanceOfSatisfying(UpstreamServiceException.class, exception -> {
                    assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.PROMOTION_PROVIDER_UNAVAILABLE);
                    assertThat(exception).hasMessageContaining("HTTP status=" + status, "page=1", "category=MEAL");
                });
    }

    @Test
    @DisplayName("네트워크 시간 초과를 외부 시스템 실패로 전달한다")
    void rejectsNetworkFailure() {
        SocketTimeoutException cause = new SocketTimeoutException("read timeout");
        server.expect(requestTo(Matchers.startsWith(URL))).andRespond(withException(cause));

        assertThatThrownBy(() -> client.fetch(CATEGORY, 1))
                .isInstanceOfSatisfying(UpstreamServiceException.class, exception -> {
                    assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.PROMOTION_PROVIDER_UNAVAILABLE);
                    assertThat(exception.getCause()).hasCause(cause);
                });
    }

    @Test
    @DisplayName("이전 응답 이후 카테고리가 달라져도 다음 요청까지 최소 1초를 기다린다")
    void spacesRequestsAcrossCategories() {
        AtomicLong secondRequestAt = new AtomicLong();
        server.expect(requestTo(URL + "?page=1&base_category_seq=1"))
                .andRespond(withSuccess("first", MediaType.TEXT_HTML));
        server.expect(requestTo(URL + "?page=1&base_category_seq=2")).andRespond(request -> {
            secondRequestAt.set(System.nanoTime());
            return withSuccess("second", MediaType.TEXT_HTML).createResponse(request);
        });

        client.fetch(CATEGORY, 1);
        long firstResponseAt = System.nanoTime();
        client.fetch(Emart24ProductCategory.SNACK, 1);

        assertThat(secondRequestAt.get() - firstResponseAt).isGreaterThanOrEqualTo(Duration.ofSeconds(1).toNanos());
    }

    @Test
    @DisplayName("대기 중 인터럽트가 발생하면 상태를 복원하고 다음 요청을 보내지 않는다")
    void stopsOnInterruption() {
        server.expect(requestTo(Matchers.startsWith(URL))).andRespond(withSuccess("first", MediaType.TEXT_HTML));
        client.fetch(CATEGORY, 1);

        Thread.currentThread().interrupt();
        try {
            assertThatThrownBy(() -> client.fetch(CATEGORY, 2)).isInstanceOf(IllegalStateException.class)
                    .hasCauseInstanceOf(InterruptedException.class);
            assertThat(Thread.currentThread().isInterrupted()).isTrue();
        } finally {
            Thread.interrupted();
        }
    }
}
