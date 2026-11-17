package com.jachwisunbae.property.storage;

import com.jachwisunbae.property.entity.photo.PhotoFile;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class PhotoStorageKeyGenerator {

    private final PhotoStorageProperties properties;

    public PhotoStorageKeyGenerator(final PhotoStorageProperties properties) {
        this.properties = properties;
    }

    public String generate(final Long memberId, final Long propertyId, final PhotoFile photoFile) {
        return properties.keyPrefix() + "members/" + memberId + "/properties/" + propertyId + "/"
            + UUID.randomUUID() + photoFile.extension();
    }

    // 썸네일은 원본과 같은 매물 경로의 thumbnails/ 아래에 원본 파일 이름 그대로 JPEG로 둔다.
    // 원본 키에서 바로 정해지므로 기존 사진의 썸네일을 나중에 만들 때도 같은 키를 쓴다.
    public String thumbnailKeyOf(final String storageKey) {
        int nameStart = storageKey.lastIndexOf('/') + 1;
        String fileName = storageKey.substring(nameStart);
        int extensionStart = fileName.lastIndexOf('.');
        String baseName = extensionStart < 0 ? fileName : fileName.substring(0, extensionStart);
        return storageKey.substring(0, nameStart) + "thumbnails/" + baseName + ".jpg";
    }
}
