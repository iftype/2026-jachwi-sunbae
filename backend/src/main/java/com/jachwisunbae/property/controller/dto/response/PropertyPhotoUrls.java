package com.jachwisunbae.property.controller.dto.response;

// 사진 응답마다 같은 주소 규칙을 쓰도록 한곳에 둔다.
final class PropertyPhotoUrls {

    private PropertyPhotoUrls() {
    }

    static String content(final Long propertyId, final Long photoId) {
        return "/api/properties/" + propertyId + "/photos/" + photoId;
    }

    static String thumbnailOf(final String contentUrl) {
        return contentUrl + "/thumbnail";
    }
}
