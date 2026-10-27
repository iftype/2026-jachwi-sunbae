package com.jachwisunbae.promotion.provider.emart24;

import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.UpstreamServiceException;
import java.io.IOException;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

// 이마트24 행사상품 페이지를 요청 간격을 지켜 하나씩 요청한다.
@Component
public class Emart24PromotionClient {

    private static final Logger LOG = LoggerFactory.getLogger(Emart24PromotionClient.class);
    static final String BASE_URL = "https://emart24.co.kr";
    private static final Duration REQUEST_INTERVAL = Duration.ofSeconds(1);
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(3);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(15);

    private final RestClient client;
    private boolean requested;

    @Autowired
    public Emart24PromotionClient() {
        this(createClient());
    }

    Emart24PromotionClient(final RestClient client) {
        this.client = client;
    }

    // 같은 클라이언트의 요청을 직렬화하고, 이전 응답 이후에도 최소 1초를 기다린다.
    synchronized String fetch(final Emart24ProductCategory category, final int page) {
        if (page < 1) {
            throw new IllegalArgumentException("수집 페이지는 1 이상이어야 합니다.");
        }
        waitForNextRequest();
        requested = true;
        long startedAt = System.nanoTime();
        try {
            return client.get().uri(uri -> uri.path("/goods/event")
                            .queryParam("page", page)
                            .queryParam("base_category_seq", category.code())
                            .build())
                    .accept(MediaType.TEXT_HTML)
                    .exchange((request, response) -> readPage(response, category, page, startedAt));
        } catch (RestClientException exception) {
            logFailure(category, page, ErrorCode.PROMOTION_PROVIDER_UNAVAILABLE, null, startedAt);
            throw new UpstreamServiceException(ErrorCode.PROMOTION_PROVIDER_UNAVAILABLE,
                    "이마트24 응답을 수신하지 못했습니다. category=" + category + ", page=" + page, exception);
        }
    }

    private String readPage(final ClientHttpResponse response, final Emart24ProductCategory category, final int page,
                            final long startedAt) throws IOException {
        int httpStatus = response.getStatusCode().value();
        // 접근 제한과 리다이렉트도 재시도하거나 따라가지 않는다.
        if (httpStatus != HttpStatus.OK.value()) {
            logFailure(category, page, ErrorCode.PROMOTION_PROVIDER_UNAVAILABLE, httpStatus, startedAt);
            throw new UpstreamServiceException(ErrorCode.PROMOTION_PROVIDER_UNAVAILABLE,
                    "이마트24 요청에 실패했습니다. category=" + category + ", page=" + page
                            + ", HTTP status=" + httpStatus);
        }
        try {
            return StreamUtils.copyToString(response.getBody(), StandardCharsets.UTF_8);
        } catch (IOException exception) {
            // 헤더 수신 후 본문 읽기가 실패하면 이미 확인한 HTTP 상태를 보존한다.
            logFailure(category, page, ErrorCode.PROMOTION_PROVIDER_UNAVAILABLE, httpStatus, startedAt);
            throw new UpstreamServiceException(ErrorCode.PROMOTION_PROVIDER_UNAVAILABLE,
                    "이마트24 응답 본문을 읽지 못했습니다. category=" + category + ", page=" + page, exception);
        }
    }

    private void logFailure(final Emart24ProductCategory category, final int page, final ErrorCode errorCode,
                            final Integer httpStatus, final long startedAt) {
        // 허용한 메타데이터만 기록한다. 응답 본문과 원본 예외 메시지는 로그에 전달하지 않는다.
        LOG.atWarn()
                .addKeyValue("category", category.name())
                .addKeyValue("page", page)
                .addKeyValue("errorCode", errorCode.name())
                .addKeyValue("httpStatus", httpStatus)
                .addKeyValue("durationMs", TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt))
                .log("promotion-emart24-request-failed");
    }

    private void waitForNextRequest() {
        if (requested) {
            try {
                Thread.sleep(REQUEST_INTERVAL);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("이마트24 수집 대기가 중단되었습니다.", exception);
            }
        }
    }

    private static RestClient createClient() {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(CONNECT_TIMEOUT)
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(READ_TIMEOUT);
        return RestClient.builder().baseUrl(BASE_URL).requestFactory(factory).build();
    }
}
