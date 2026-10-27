package com.jachwisunbae.promotion.provider.emart24;

import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.UpstreamServiceException;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

// 이마트24 행사상품 페이지를 요청 간격을 지켜 하나씩 요청한다.
@Component
public class Emart24PromotionClient {

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
        try {
            return client.get().uri(uri -> uri.path("/goods/event")
                            .queryParam("page", page)
                            .queryParam("base_category_seq", category.code())
                            .build())
                    .accept(MediaType.TEXT_HTML)
                    .exchange((request, response) -> {
                        int status = response.getStatusCode().value();
                        // 접근 제한과 리다이렉트도 재시도하거나 따라가지 않는다.
                        if (status != HttpStatus.OK.value()) {
                            throw new UpstreamServiceException(ErrorCode.PROMOTION_PROVIDER_UNAVAILABLE,
                                    "이마트24 요청에 실패했습니다. category=" + category + ", page=" + page
                                            + ", HTTP status=" + status);
                        }
                        return StreamUtils.copyToString(response.getBody(), StandardCharsets.UTF_8);
                    });
        } catch (RestClientException exception) {
            throw new UpstreamServiceException(ErrorCode.PROMOTION_PROVIDER_UNAVAILABLE,
                    "이마트24 응답을 수신하지 못했습니다. category=" + category + ", page=" + page, exception);
        }
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
