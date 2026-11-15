package com.jachwisunbae.property.storage;

// 사진 바이트가 꼭 필요한 곳(비교 PDF)에서만 쓴다. 큰 사진을 여러 번 복사하지 않도록 배열을 복사하지 않는다.
public record PhotoContent(byte[] bytes, String contentType) {
}
