package com.jachwisunbae.streetmemo.controller;

import com.jachwisunbae.auth.web.AuthenticatedMemberId;
import com.jachwisunbae.common.web.ApiResponse;
import com.jachwisunbae.streetmemo.controller.dto.request.CreateStreetMemoRequest;
import com.jachwisunbae.streetmemo.controller.dto.response.StreetMemoResponse;
import com.jachwisunbae.streetmemo.domain.StreetMemoPreference;
import com.jachwisunbae.streetmemo.service.StreetMemoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/street-memos")
@SecurityRequirement(name = "bearerAuth")
public class StreetMemoController {

    private final StreetMemoService streetMemoService;

    public StreetMemoController(final StreetMemoService streetMemoService) {
        this.streetMemoService = streetMemoService;
    }

    @PostMapping
    @Operation(summary = "거리 메모 작성",
            description = "인증된 회원이 위치·내용·선호를 함께 저장합니다. "
            + "작성자는 인증 정보로 결정하며 응답에 작성자 식별 정보를 포함하지 않습니다.")
    public ResponseEntity<ApiResponse<StreetMemoResponse>> create(
            @AuthenticatedMemberId final Long memberId,
            @Valid @RequestBody final CreateStreetMemoRequest request) {
        StreetMemoResponse response = StreetMemoResponse.from(streetMemoService.create(memberId,
                request.latitude(), request.longitude(), request.memo(),
                StreetMemoPreference.fromCode(request.preference())));
        return ResponseEntity.created(URI.create("/api/street-memos/" + response.streetMemoId()))
                .body(ApiResponse.of("거리 메모를 등록했습니다.", response));
    }

    @GetMapping
    @Operation(summary = "지도 영역의 거리 메모 조회",
            description = "사각형 영역의 경계를 포함해 모든 회원의 미삭제 메모를 조회합니다. "
            + "isMine으로 현재 회원이 작성한 메모인지 확인할 수 있습니다. "
            + "정렬 순서와 결과 상한은 보장하지 않으며 결과가 없으면 빈 배열을 반환합니다.")
    public ApiResponse<List<StreetMemoResponse>> findAllWithin(
            @AuthenticatedMemberId final Long memberId,
            @RequestParam(required = false) final BigDecimal minLatitude,
            @RequestParam(required = false) final BigDecimal maxLatitude,
            @RequestParam(required = false) final BigDecimal minLongitude,
            @RequestParam(required = false) final BigDecimal maxLongitude) {
        List<StreetMemoResponse> responses = streetMemoService
                .findAllWithin(memberId, minLatitude, maxLatitude, minLongitude, maxLongitude)
                .stream().map(StreetMemoResponse::from).toList();
        return ApiResponse.of("거리 메모 목록을 조회했습니다.", responses);
    }

    @DeleteMapping("/{streetMemoId}")
    @Operation(summary = "본인 거리 메모 삭제",
            description = "본인이 작성한 미삭제 메모를 논리 삭제합니다. "
            + "타인의 메모, 존재하지 않는 메모, 이미 삭제된 메모는 모두 404로 응답합니다.")
    public ResponseEntity<Void> delete(
            @AuthenticatedMemberId final Long memberId,
            @PathVariable final long streetMemoId) {
        streetMemoService.delete(memberId, streetMemoId);
        return ResponseEntity.noContent().build();
    }
}
