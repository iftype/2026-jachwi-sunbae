package com.jachwisunbae.map.provider.kakao;

import com.jachwisunbae.map.domain.agency.Agency;
import com.jachwisunbae.map.provider.AgencyProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

// 카카오 중개업소 카테고리(AG2)를 거리순으로 조회해 Agency로 변환한다. 카카오 제한으로 최대 45건이다.
@Component
@ConditionalOnProperty(name = "map.nearby.provider", havingValue = "kakao")
public class KakaoAgencyProvider implements AgencyProvider {

    private static final String AGENCY_CATEGORY_CODE = "AG2";
    private static final Logger LOG = LoggerFactory.getLogger(KakaoAgencyProvider.class);

    private final KakaoPlaceClient client;

    public KakaoAgencyProvider(KakaoPlaceClient client) {
        this.client = client;
    }

    @Override
    public List<Agency> nearby(BigDecimal latitude, BigDecimal longitude, int radius) {
        List<Agency> agencies = new ArrayList<>();
        for (KakaoCategorySearchResponse.Document document :
                client.searchCategoryPages(AGENCY_CATEGORY_CODE, latitude, longitude, radius)) {
            // 필수 값이 없는 document는 로그를 남기고 제외한다. 데이터 하나가 이상하다고 전체를 실패시키지 않는다.
            if (!document.hasRequiredFields()) {
                LOG.warn("카카오 중개업소 응답에 필수 값이 없어 제외합니다. id={}", document.id());
                continue;
            }
            agencies.add(agency(document));
        }
        return List.copyOf(agencies);
    }

    private Agency agency(KakaoCategorySearchResponse.Document document) {
        return new Agency("kakao:" + document.id(),
                document.placeName(),
                document.preferredAddress(),
                document.latitude(),
                document.longitude(),
                document.distance(),
                document.phone(),
                document.placeUrl());
    }
}
