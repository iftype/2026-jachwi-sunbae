package com.jachwisunbae.map.provider.kakao;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.MissingNode;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.UpstreamServiceException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.math.BigDecimal;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Component
@ConditionalOnProperty(name = "map.nearby.provider", havingValue = "kakao")
public class KakaoPlaceClient {

    private static final String BASE_URL = "https://dapi.kakao.com";
    private static final int PAGE_SIZE = 15;
    // 캐시 없이 요청마다 호출하므로 카테고리당 호출 수를 제한한다. 카카오도 최대 45건까지만 제공한다.
    private static final int MAX_PAGE_COUNT = 3;

    private final RestClient client;

    @Autowired
    public KakaoPlaceClient(@Value("${map.kakao.rest-api-key}") String restApiKey,
                            @Value("${map.connect-timeout-millis:2000}") long connectTimeoutMillis,
                            @Value("${map.read-timeout-millis:5000}") long readTimeoutMillis) {
        this(createClient(restApiKey, connectTimeoutMillis, readTimeoutMillis));
    }

    KakaoPlaceClient(RestClient client) {
        this.client = client;
    }

    private static RestClient createClient(String restApiKey, long connectTimeoutMillis, long readTimeoutMillis) {
        if (restApiKey == null || restApiKey.isBlank()) {
            throw new IllegalStateException("kakao 주변 시설 모드에는 KAKAO_REST_API_KEY가 필요합니다.");
        }
        //TODO connection pool / keep-alive 설정 고려
        HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofMillis(connectTimeoutMillis))
            .build();

        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofMillis(readTimeoutMillis));
        return RestClient.builder()
            .baseUrl(BASE_URL)
            .defaultHeader(HttpHeaders.AUTHORIZATION, "KakaoAK " + restApiKey)
            .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
            .requestFactory(requestFactory)
            .build();
    }

    // 마지막 페이지 또는 최대 페이지 수까지 순회하며 document를 모은다.
    public List<KakaoCategorySearchResponse.Document> searchCategoryPages(String categoryCode, BigDecimal latitude,
                                                                          BigDecimal longitude, int radius) {
        List<KakaoCategorySearchResponse.Document> documents = new ArrayList<>();
        for (int page = 1; page <= MAX_PAGE_COUNT; page++) {
            KakaoCategorySearchResponse response = searchCategory(categoryCode, latitude, longitude, radius, page);
            documents.addAll(response.documents());

            if (response.end()) {
                break;
            }
        }
        return documents;
    }

    public KakaoCategorySearchResponse searchCategory(String categoryCode, BigDecimal latitude,
                                                      BigDecimal longitude, int radius, int page) {
        return response(request(categoryCode, latitude, longitude, radius, page));
    }

    // 통신 실패만 외부 장애로 바꾼다. 응답 해석은 요청 밖에서 해서 우리 코드의 오류를 외부 장애로 숨기지 않는다.
    private JsonNode request(String categoryCode, BigDecimal latitude, BigDecimal longitude, int radius, int page) {
        try {
            JsonNode root = client.get().uri(uri -> uri.path("/v2/local/search/category.json")
                    .queryParam("category_group_code", categoryCode)
                    .queryParam("x", longitude)
                    .queryParam("y", latitude)
                    .queryParam("radius", radius)
                    .queryParam("sort", "distance")
                    .queryParam("page", page)
                    .queryParam("size", PAGE_SIZE)
                    .build())
                .retrieve()
                .body(JsonNode.class);
            return Objects.requireNonNullElse(root, MissingNode.getInstance());
        } catch (RestClientException exception) {
            throw new UpstreamServiceException(ErrorCode.MAP_PROVIDER_UNAVAILABLE,
                "주변 시설 공급자 요청에 실패했습니다.", exception);
        }
    }

    private KakaoCategorySearchResponse response(JsonNode root) {
        List<KakaoCategorySearchResponse.Document> documents = new ArrayList<>();
        for (JsonNode document : root.path("documents")) {
            documents.add(new KakaoCategorySearchResponse.Document(
                text(document, "id"),
                text(document, "place_name"),
                text(document, "road_address_name"),
                text(document, "address_name"),
                decimal(document, "y"),
                decimal(document, "x"),
                integer(document, "distance"),
                text(document, "phone"),
                text(document, "place_url")));
        }
        return new KakaoCategorySearchResponse(List.copyOf(documents),
            root.path("meta").path("is_end").asBoolean(true));
    }

    // 값이 없는 필드는 null로 두고, 필수 값 검사는 KakaoNearbyPlaceProvider가 맡는다.
    private String text(JsonNode node, String name) {
        String value = node.path(name).asText("");
        if (value.isBlank()) {
            return null;
        }
        return value;
    }

    // 응답은 성공했지만 숫자 형식이 잘못되면 외부 응답 형식 오류로 본다.
    private BigDecimal decimal(JsonNode node, String name) {
        String value = text(node, name);
        if (value == null) {
            return null;
        }
        try {
            return new BigDecimal(value);
        } catch (NumberFormatException exception) {
            throw malformedNumber(name, value, exception);
        }
    }

    private Integer integer(JsonNode node, String name) {
        String value = text(node, name);
        if (value == null) {
            return null;
        }
        try {
            return Integer.valueOf(value);
        } catch (NumberFormatException exception) {
            throw malformedNumber(name, value, exception);
        }
    }

    private UpstreamServiceException malformedNumber(String name, String value, NumberFormatException cause) {
        return new UpstreamServiceException(ErrorCode.MAP_PROVIDER_UNAVAILABLE,
            "카카오 응답의 숫자 형식이 올바르지 않습니다. " + name + "=" + value, cause);
    }
}
