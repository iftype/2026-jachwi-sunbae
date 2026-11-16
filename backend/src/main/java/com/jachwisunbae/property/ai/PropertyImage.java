package com.jachwisunbae.property.ai;

// 분석에만 쓰고 저장하지 않는 매물 캡처 이미지다.
public record PropertyImage(
        byte[] content,
        String contentType) {
}
