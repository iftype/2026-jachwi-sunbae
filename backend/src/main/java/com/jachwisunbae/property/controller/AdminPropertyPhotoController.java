package com.jachwisunbae.property.controller;

import com.jachwisunbae.common.web.ApiResponse;
import com.jachwisunbae.property.service.PropertyPhotoThumbnailBackfillService;
import com.jachwisunbae.property.service.dto.result.PhotoThumbnailBackfillResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/property-photos")
@Tag(name = "Admin property photos", description = "Authorization: Admin <접속 코드>가 필요한 사진 운영 API")
public class AdminPropertyPhotoController {

    private final PropertyPhotoThumbnailBackfillService backfillService;

    public AdminPropertyPhotoController(final PropertyPhotoThumbnailBackfillService backfillService) {
        this.backfillService = backfillService;
    }

    @PostMapping("/thumbnails")
    @Operation(summary = "기존 사진 썸네일 생성",
            description = "썸네일이 없는 사진을 ID 순서로 batchSize장(1~50)씩 처리합니다. "
                    + "hasMore가 true면 lastPhotoId를 afterPhotoId로 넘겨 다시 호출합니다. "
                    + "썸네일을 만들 수 없는 사진(HEIC 등)은 skipped로 세고 원본으로 대신합니다. 인증 실패 401, 저장소 장애 502.")
    public ApiResponse<PhotoThumbnailBackfillResult> backfillThumbnails(
            @RequestParam(defaultValue = "0") final long afterPhotoId,
            @RequestParam(defaultValue = "20") final int batchSize) {
        return ApiResponse.of(backfillService.backfill(afterPhotoId, batchSize));
    }
}
