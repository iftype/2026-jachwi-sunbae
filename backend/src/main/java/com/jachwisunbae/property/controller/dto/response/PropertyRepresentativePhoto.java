package com.jachwisunbae.property.controller.dto.response;

// url은 원본(상세 대표 사진·사진 뷰어용), thumbnailUrl은 목록 카드·지도 마커 같은 작은 화면용 썸네일이다.
public record PropertyRepresentativePhoto(Long id, String url, String thumbnailUrl, String contentType) {

    // 썸네일 주소는 원본 주소에서 정해진다. 만드는 쪽은 원본 주소만 넘긴다.
    public PropertyRepresentativePhoto(final Long id, final String url, final String contentType) {
        this(id, url, PropertyPhotoUrls.thumbnailOf(url), contentType);
    }
}
