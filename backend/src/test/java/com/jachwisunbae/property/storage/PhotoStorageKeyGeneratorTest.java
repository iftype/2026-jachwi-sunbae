package com.jachwisunbae.property.storage;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PhotoStorageKeyGeneratorTest {

    private final PhotoStorageKeyGenerator generator = new PhotoStorageKeyGenerator(
            new PhotoStorageProperties("ap-northeast-2", null, null, null, "bucket", "photos"));

    @Test
    @DisplayName("썸네일 키는 원본과 같은 매물 경로의 thumbnails/ 아래에 원본 이름의 JPEG로 정한다")
    void derivesThumbnailKey() {
        // when
        String key = generator.thumbnailKeyOf("photos/members/1/properties/2/3f2a.heic");

        // then
        assertThat(key).isEqualTo("photos/members/1/properties/2/thumbnails/3f2a.jpg");
    }
}
