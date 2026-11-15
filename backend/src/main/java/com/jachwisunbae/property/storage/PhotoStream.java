package com.jachwisunbae.property.storage;

import java.io.InputStream;

// 사진 원본을 메모리에 모두 올리지 않고 흘려보내기 위한 스트림. 다 쓴 쪽이 닫는다.
public record PhotoStream(InputStream content, long contentLength, String contentType) {

    public PhotoStream withContentType(final String contentType) {
        return new PhotoStream(content, contentLength, contentType);
    }
}
