package com.jachwisunbae.map.provider.kakao;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.UpstreamServiceException;
import java.math.BigDecimal;
import java.net.SocketTimeoutException;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class KakaoPlaceClientTest {

    private static final BigDecimal LATITUDE = new BigDecimal("37.406");
    private static final BigDecimal LONGITUDE = new BigDecimal("127.088");

    private MockRestServiceServer server;
    private KakaoPlaceClient client;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://dapi.kakao.com");
        server = MockRestServiceServer.bindTo(builder).build();
        client = new KakaoPlaceClient(builder.build());
    }

    @Test
    @DisplayName("좌표, 반경, 카테고리 코드로 거리순 카테고리 검색을 요청하고 응답을 변환한다")
    void requestsCategorySearchAndParsesResponse() {
        server.expect(requestTo(Matchers.containsString("/v2/local/search/category.json")))
                .andExpect(queryParam("category_group_code", "CS2"))
                .andExpect(queryParam("x", "127.088"))
                .andExpect(queryParam("y", "37.406"))
                .andExpect(queryParam("radius", "500"))
                .andExpect(queryParam("sort", "distance"))
                .andExpect(queryParam("page", "2"))
                .andExpect(queryParam("size", "15"))
                .andRespond(withSuccess("""
                        {
                          "meta": {"is_end": false},
                          "documents": [{
                            "id": "123",
                            "place_name": "이마트24 KT판교사옥점",
                            "road_address_name": "경기 성남시 수정구 금토로 32",
                            "address_name": "경기 성남시 수정구 금토동 696",
                            "y": "37.4066144",
                            "x": "127.0908479",
                            "distance": "250",
                            "phone": "031-123-4567",
                            "place_url": "http://place.map.kakao.com/123"
                          }]
                        }
                        """, MediaType.APPLICATION_JSON));

        KakaoCategorySearchResponse response = client.searchCategory("CS2", LATITUDE, LONGITUDE, 500, 2);

        assertThat(response.end()).isFalse();
        assertThat(response.documents()).containsExactly(new KakaoCategorySearchResponse.Document(
                "123", "이마트24 KT판교사옥점", "경기 성남시 수정구 금토로 32", "경기 성남시 수정구 금토동 696",
                new BigDecimal("37.4066144"), new BigDecimal("127.0908479"), 250,
                "031-123-4567", "http://place.map.kakao.com/123"));
        server.verify();
    }

    @Test
    @DisplayName("비어 있거나 없는 필드는 null로 변환한다")
    void parsesBlankOrMissingFieldsAsNull() {
        server.expect(requestTo(Matchers.containsString("/v2/local/search/category.json")))
                .andRespond(withSuccess("""
                        {
                          "meta": {"is_end": true},
                          "documents": [{"id": "1", "place_name": "", "road_address_name": "", "phone": ""}]
                        }
                        """, MediaType.APPLICATION_JSON));

        KakaoCategorySearchResponse response = client.searchCategory("HP8", LATITUDE, LONGITUDE, 500, 1);

        assertThat(response.end()).isTrue();
        assertThat(response.documents()).containsExactly(
                new KakaoCategorySearchResponse.Document("1", null, null, null, null, null, null, null, null));
    }

    @Test
    @DisplayName("카카오 요청이 실패하면 지도 공급자 오류로 변환한다")
    void convertsRequestFailureToProviderUnavailable() {
        server.expect(requestTo(Matchers.containsString("/v2/local/search/category.json")))
                .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));

        assertThatThrownBy(() -> client.searchCategory("HP8", LATITUDE, LONGITUDE, 500, 1))
                .isInstanceOfSatisfying(UpstreamServiceException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.MAP_PROVIDER_UNAVAILABLE));
    }

    @Test
    @DisplayName("연결이 실패하거나 응답 시간이 초과되면 지도 공급자 오류로 변환한다")
    void convertsConnectionFailureToProviderUnavailable() {
        server.expect(requestTo(Matchers.containsString("/v2/local/search/category.json")))
                .andRespond(withException(new SocketTimeoutException("Read timed out")));

        assertThatThrownBy(() -> client.searchCategory("HP8", LATITUDE, LONGITUDE, 500, 1))
                .isInstanceOfSatisfying(UpstreamServiceException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.MAP_PROVIDER_UNAVAILABLE));
    }

    @Test
    @DisplayName("응답의 숫자 형식이 잘못되면 지도 공급자 오류로 변환한다")
    void convertsMalformedNumberToProviderUnavailable() {
        server.expect(requestTo(Matchers.containsString("/v2/local/search/category.json")))
                .andRespond(withSuccess("""
                        {"meta": {"is_end": true}, "documents": [{"id": "1", "y": "위도"}]}
                        """, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.searchCategory("HP8", LATITUDE, LONGITUDE, 500, 1))
                .isInstanceOfSatisfying(UpstreamServiceException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.MAP_PROVIDER_UNAVAILABLE));
    }

    @Test
    @DisplayName("REST API 키가 없으면 클라이언트를 만들 수 없다")
    void requiresRestApiKey() {
        assertThatThrownBy(() -> new KakaoPlaceClient(" ", 2000, 5000))
                .isInstanceOf(IllegalStateException.class);
    }
}
