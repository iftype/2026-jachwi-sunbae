package com.jachwisunbae.property.service.dto.result;

// hasMore가 true면 lastPhotoId를 다음 요청의 afterPhotoId로 넘긴다.
public record PhotoThumbnailBackfillResult(int processed, int created, int skipped, long lastPhotoId,
                                           boolean hasMore) {
}
