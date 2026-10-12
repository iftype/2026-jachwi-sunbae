package com.jachwisunbae.map.provider.kakao;

import com.jachwisunbae.map.domain.NearbyPlace;
import com.jachwisunbae.map.provider.NearbyPlaceProvider;
import com.jachwisunbae.map.type.MapCategory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

//우리 서비스의 카테고리들을 카카오 장소 검색 API에 맞게 바꾸고,
// 카카오에서 여러 페이지를 조회한 뒤, 결과를 우리 도메인인 NearbyPlace로 변환해서 반환
@Component
@ConditionalOnProperty(name = "map.nearby.provider", havingValue = "kakao")
public class KakaoNearbyPlaceProvider implements NearbyPlaceProvider {

    // 캐시 없이 요청마다 호출하므로 카테고리당 호출 수를 제한한다.
    private static final int MAX_PAGE_COUNT = 3;
    // 카카오로 조회하는 카테고리와 카카오 카테고리 코드. 교통은 버스정류장 DB에서 조회한다.
    private static final Map<MapCategory, String> CATEGORY_CODES = new EnumMap<>(Map.of(
            MapCategory.HOSPITAL, "HP8",
            MapCategory.SCHOOL, "SC4",
            MapCategory.CONVENIENCE, "CS2",
            MapCategory.AGENCY, "AG2"));
    private static final Logger LOG = LoggerFactory.getLogger(KakaoNearbyPlaceProvider.class);

    private final KakaoPlaceClient client;

    public KakaoNearbyPlaceProvider(KakaoPlaceClient client) {
        this.client = client;
    }

    @Override
    public List<NearbyPlace> nearby(BigDecimal latitude, BigDecimal longitude, int radius,
                                    Set<MapCategory> categories) {
        Map<String, NearbyPlace> unique = new LinkedHashMap<>();

        for (MapCategory category : categories) {
            if (!CATEGORY_CODES.containsKey(category)) {
                continue;
            }
            List<KakaoCategorySearchResponse.Document> documents = searchPages(category, latitude, longitude, radius);
            List<KakaoCategorySearchResponse.Document> validDocuments = filterValid(documents, category);
            addUniquePlaces(unique, validDocuments, category);
        }
        return List.copyOf(unique.values());
    }

    // 카카오 API를 마지막 페이지 또는 최대 페이지 수까지 순회하며 document를 모은다.
    private List<KakaoCategorySearchResponse.Document> searchPages(MapCategory category, BigDecimal latitude,
                                                                   BigDecimal longitude, int radius) {
        List<KakaoCategorySearchResponse.Document> documents = new ArrayList<>();
        for (int page = 1; page <= MAX_PAGE_COUNT; page++) {
            KakaoCategorySearchResponse response =
                    client.searchCategory(CATEGORY_CODES.get(category), latitude, longitude, radius, page);
            documents.addAll(response.documents());

            if (response.end()) {
                break;
            }
        }
        return documents;
    }

    // 필수 값이 없는 document는 로그를 남기고 제외한다. 데이터 하나가 이상하다고 전체를 실패시키지 않는다.
    private List<KakaoCategorySearchResponse.Document> filterValid(List<KakaoCategorySearchResponse.Document> documents,
                                                                   MapCategory category) {
        List<KakaoCategorySearchResponse.Document> validDocuments = new ArrayList<>();
        for (KakaoCategorySearchResponse.Document document : documents) {
            if (!hasRequiredFields(document)) {
                LOG.warn("카카오 주변 시설 응답에 필수 값이 없어 제외합니다. category={}, id={}", category, document.id());
                continue;
            }
            validDocuments.add(document);
        }
        return validDocuments;
    }

    // NearbyPlace로 변환하고, 이미 담긴 장소 ID는 먼저 들어온 것을 유지한다.
    private void addUniquePlaces(Map<String, NearbyPlace> unique, List<KakaoCategorySearchResponse.Document> documents,
                                 MapCategory category) {
        for (KakaoCategorySearchResponse.Document document : documents) {
            NearbyPlace place = place(document, category);
            unique.putIfAbsent(place.providerPlaceId(), place);
        }
    }

    private boolean hasRequiredFields(KakaoCategorySearchResponse.Document document) {
        return document.id() != null && document.placeName() != null
                && document.latitude() != null && document.longitude() != null && document.distance() != null;
    }

    private NearbyPlace place(KakaoCategorySearchResponse.Document document, MapCategory category) {
        return new NearbyPlace("kakao:" + document.id(),
                document.placeName(),
                category,
                address(document),
                document.latitude(),
                document.longitude(),
                document.distance());
    }

    //도로명 주소가 있으면 우선 사용
    private String address(KakaoCategorySearchResponse.Document document) {
        if (document.roadAddressName() == null) {
            return document.addressName();
        }
        return document.roadAddressName();
    }
}
