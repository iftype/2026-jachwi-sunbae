package com.jachwisunbae.map.provider.kakao;

import static org.assertj.core.api.Assertions.assertThat;

import com.jachwisunbae.map.domain.NearbyPlace;
import com.jachwisunbae.map.type.MapCategory;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

class KakaoNearbyPlaceProviderTest {

    private static final BigDecimal LATITUDE = new BigDecimal("37.406");
    private static final BigDecimal LONGITUDE = new BigDecimal("127.088");

    private final FakeKakaoPlaceClient client = new FakeKakaoPlaceClient();
    private final KakaoNearbyPlaceProvider provider = new KakaoNearbyPlaceProvider(client);

    @Test
    @DisplayName("카카오 검색 결과를 주변 시설로 변환한다")
    void mapsDocumentsToNearbyPlaces() {
        client.respond("CS2", 1, true, new KakaoCategorySearchResponse.Document("123", "이마트24 KT판교사옥점",
                "경기 성남시 수정구 금토로 32", "경기 성남시 수정구 금토동 696",
                new BigDecimal("37.4066144"), new BigDecimal("127.0908479"), 250));

        List<NearbyPlace> places = provider.nearby(LATITUDE, LONGITUDE, 500, EnumSet.of(MapCategory.CONVENIENCE));

        assertThat(places).containsExactly(new NearbyPlace("kakao:123", "이마트24 KT판교사옥점",
                MapCategory.CONVENIENCE, "경기 성남시 수정구 금토로 32",
                new BigDecimal("37.4066144"), new BigDecimal("127.0908479"), 250));
    }

    @Test
    @DisplayName("도로명주소가 없으면 지번 주소를 사용한다")
    void usesJibunAddressWhenRoadAddressIsMissing() {
        client.respond("HP8", 1, true, document("1", null, "경기 성남시 수정구 금토동 715"));

        List<NearbyPlace> places = provider.nearby(LATITUDE, LONGITUDE, 500, EnumSet.of(MapCategory.HOSPITAL));

        assertThat(places).extracting(NearbyPlace::address).containsExactly("경기 성남시 수정구 금토동 715");
    }

    @Test
    @DisplayName("필수 값이 없는 장소는 제외하고 나머지 장소를 반환한다")
    void skipsDocumentsWithoutRequiredFields() {
        client.respond("CS2", 1, true,
                document("1", "도로명 1", "지번 1"),
                new KakaoCategorySearchResponse.Document("2", null, "도로명 2", "지번 2",
                        new BigDecimal("37.4064"), new BigDecimal("127.0888"), 100),
                new KakaoCategorySearchResponse.Document("3", "좌표 없는 편의점", "도로명 3", "지번 3",
                        null, null, 100),
                document("4", "도로명 4", "지번 4"));

        List<NearbyPlace> places = provider.nearby(LATITUDE, LONGITUDE, 500, EnumSet.of(MapCategory.CONVENIENCE));

        assertThat(places).extracting(NearbyPlace::providerPlaceId).containsExactly("kakao:1", "kakao:4");
    }

    @Test
    @DisplayName("도로명주소와 지번 주소가 모두 없으면 빈 주소로 반환한다")
    void returnsEmptyAddressWhenBothAddressesAreMissing() {
        client.respond("AG2", 1, true, document("1", null, null));

        List<NearbyPlace> places = provider.nearby(LATITUDE, LONGITUDE, 500, EnumSet.of(MapCategory.AGENCY));

        assertThat(places).extracting(NearbyPlace::address).containsExactly("");
    }

    @Test
    @DisplayName("마지막 페이지가 아니면 다음 페이지를 조회하고 마지막 페이지에서 멈춘다")
    void readsNextPageUntilLastPage() {
        client.respond("HP8", 1, false, document("1", "도로명 1", "지번 1"));
        client.respond("HP8", 2, true, document("2", "도로명 2", "지번 2"));

        List<NearbyPlace> places = provider.nearby(LATITUDE, LONGITUDE, 1000, EnumSet.of(MapCategory.HOSPITAL));

        assertThat(places).extracting(NearbyPlace::providerPlaceId).containsExactly("kakao:1", "kakao:2");
        assertThat(client.requests()).containsExactly("HP8:1", "HP8:2");
    }

    @Test
    @DisplayName("카테고리당 최대 3페이지까지만 조회한다")
    void readsAtMostThreePagesPerCategory() {
        client.respond("SC4", 1, false, document("1", "도로명 1", "지번 1"));
        client.respond("SC4", 2, false, document("2", "도로명 2", "지번 2"));
        client.respond("SC4", 3, false, document("3", "도로명 3", "지번 3"));

        List<NearbyPlace> places = provider.nearby(LATITUDE, LONGITUDE, 2000, EnumSet.of(MapCategory.SCHOOL));

        assertThat(places).hasSize(3);
        assertThat(client.requests()).containsExactly("SC4:1", "SC4:2", "SC4:3");
    }

    @Test
    @DisplayName("교통을 뺀 카테고리마다 카카오 카테고리 코드로 조회한다")
    void mapsEveryFacilityCategoryToKakaoCode() {
        client.respond("HP8", 1, true, document("1", "병원", null));
        client.respond("SC4", 1, true, document("3", "학교", null));
        client.respond("CS2", 1, true, document("4", "편의점", null));
        client.respond("AG2", 1, true, document("5", "중개업소", null));
        EnumSet<MapCategory> facilities = EnumSet.complementOf(EnumSet.of(MapCategory.TRANSPORT));

        List<NearbyPlace> places = provider.nearby(LATITUDE, LONGITUDE, 500, facilities);

        assertThat(places).extracting(NearbyPlace::category).containsExactlyElementsOf(facilities);
        assertThat(client.requests()).containsExactly("HP8:1", "SC4:1", "CS2:1", "AG2:1");
    }

    @Test
    @DisplayName("교통 카테고리는 카카오로 조회하지 않는다")
    void doesNotSearchTransportCategory() {
        List<NearbyPlace> places = provider.nearby(LATITUDE, LONGITUDE, 500, EnumSet.of(MapCategory.TRANSPORT));

        assertThat(places).isEmpty();
        assertThat(client.requests()).isEmpty();
    }

    private static KakaoCategorySearchResponse.Document document(String id, String roadAddress, String address) {
        return new KakaoCategorySearchResponse.Document(id, "장소 " + id, roadAddress, address,
                new BigDecimal("37.4064"), new BigDecimal("127.0888"), 100);
    }

    private static class FakeKakaoPlaceClient extends KakaoPlaceClient {

        private final Map<String, KakaoCategorySearchResponse> responses = new HashMap<>();
        private final List<String> requests = new ArrayList<>();

        FakeKakaoPlaceClient() {
            super((RestClient) null);
        }

        void respond(String categoryCode, int page, boolean end, KakaoCategorySearchResponse.Document... documents) {
            responses.put(categoryCode + ":" + page, new KakaoCategorySearchResponse(List.of(documents), end));
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
