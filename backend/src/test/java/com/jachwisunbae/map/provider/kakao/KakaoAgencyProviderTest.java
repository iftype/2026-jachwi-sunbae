package com.jachwisunbae.map.provider.kakao;

import static org.assertj.core.api.Assertions.assertThat;

import com.jachwisunbae.map.domain.agency.Agency;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

class KakaoAgencyProviderTest {

    private static final BigDecimal LATITUDE = new BigDecimal("37.406");
    private static final BigDecimal LONGITUDE = new BigDecimal("127.088");

    private final FakeKakaoPlaceClient client = new FakeKakaoPlaceClient();
    private final KakaoAgencyProvider provider = new KakaoAgencyProvider(client);

    @Test
    @DisplayName("중개업소 카테고리 검색 결과를 전화번호와 상세 페이지 URL을 포함한 중개업소로 변환한다")
    void mapsDocumentsToAgencies() {
        client.respond(1, true, new KakaoCategorySearchResponse.Document("123", "판교 공인중개사",
                "경기 성남시 분당구 판교역로 1", "경기 성남시 분당구 백현동 1",
                new BigDecimal("37.4066"), new BigDecimal("127.0908"), 250,
                "031-123-4567", "http://place.map.kakao.com/123"));

        List<Agency> agencies = provider.nearby(LATITUDE, LONGITUDE, 500);

        assertThat(agencies).containsExactly(new Agency("kakao:123", "판교 공인중개사", "경기 성남시 분당구 판교역로 1",
                new BigDecimal("37.4066"), new BigDecimal("127.0908"), 250,
                "031-123-4567", "http://place.map.kakao.com/123"));
        assertThat(client.requests()).containsExactly("AG2:1");
    }

    @Test
    @DisplayName("전화번호와 상세 페이지 URL이 없으면 null로 반환한다")
    void returnsNullWhenPhoneAndPlaceUrlAreMissing() {
        client.respond(1, true, document("1", null, null));

        List<Agency> agencies = provider.nearby(LATITUDE, LONGITUDE, 500);

        assertThat(agencies).singleElement().satisfies(agency -> {
            assertThat(agency.phone()).isNull();
            assertThat(agency.placeUrl()).isNull();
        });
    }

    @Test
    @DisplayName("필수 값이 없는 장소는 제외하고 나머지 장소를 반환한다")
    void skipsDocumentsWithoutRequiredFields() {
        client.respond(1, true,
                document("1", "02-111-1111", null),
                new KakaoCategorySearchResponse.Document("2", null, "도로명 2", "지번 2",
                        new BigDecimal("37.4064"), new BigDecimal("127.0888"), 100, null, null),
                document("3", null, null));

        List<Agency> agencies = provider.nearby(LATITUDE, LONGITUDE, 500);

        assertThat(agencies).extracting(Agency::providerPlaceId).containsExactly("kakao:1", "kakao:3");
    }

    @Test
    @DisplayName("최대 3페이지까지 조회한다")
    void readsAtMostThreePages() {
        client.respond(1, false, document("1", null, null));
        client.respond(2, false, document("2", null, null));
        client.respond(3, false, document("3", null, null));

        List<Agency> agencies = provider.nearby(LATITUDE, LONGITUDE, 2000);

        assertThat(agencies).hasSize(3);
        assertThat(client.requests()).containsExactly("AG2:1", "AG2:2", "AG2:3");
    }

    private static KakaoCategorySearchResponse.Document document(String id, String phone, String placeUrl) {
        return new KakaoCategorySearchResponse.Document(id, "중개업소 " + id, "도로명 " + id, "지번 " + id,
                new BigDecimal("37.4064"), new BigDecimal("127.0888"), 100, phone, placeUrl);
    }

    private static class FakeKakaoPlaceClient extends KakaoPlaceClient {

        private final Map<String, KakaoCategorySearchResponse> responses = new HashMap<>();
        private final List<String> requests = new ArrayList<>();

        FakeKakaoPlaceClient() {
            super((RestClient) null);
        }

        void respond(int page, boolean end, KakaoCategorySearchResponse.Document... documents) {
            responses.put("AG2:" + page, new KakaoCategorySearchResponse(List.of(documents), end));
        }

        List<String> requests() {
            return requests;
        }

        @Override
        public KakaoCategorySearchResponse searchCategory(String categoryCode, BigDecimal latitude,
                                                          BigDecimal longitude, int radius, int page) {
            String key = categoryCode + ":" + page;
            requests.add(key);
            return responses.getOrDefault(key, new KakaoCategorySearchResponse(List.of(), true));
        }
    }
}
