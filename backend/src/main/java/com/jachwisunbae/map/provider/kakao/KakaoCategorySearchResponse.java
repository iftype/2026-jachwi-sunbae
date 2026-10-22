package com.jachwisunbae.map.provider.kakao;

import java.math.BigDecimal;
import java.util.List;

public record KakaoCategorySearchResponse(List<Document> documents, boolean end) {

    // phone, placeUrl은 선택 값이라 필수 값 검사에 포함하지 않는다.
    public record Document(String id, String placeName, String roadAddressName, String addressName,
                           BigDecimal latitude, BigDecimal longitude, Integer distance,
                           String phone, String placeUrl) {

        public boolean hasRequiredFields() {
            return id != null && placeName != null && latitude != null && longitude != null && distance != null;
        }

        // 도로명 주소가 있으면 우선 사용
        public String preferredAddress() {
            if (roadAddressName == null) {
                return addressName;
            }
            return roadAddressName;
        }
    }
}
