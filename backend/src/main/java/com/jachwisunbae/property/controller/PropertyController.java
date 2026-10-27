package com.jachwisunbae.property.controller;

import com.jachwisunbae.auth.web.AuthenticatedMemberId;
import com.jachwisunbae.common.web.ApiResponse;
import com.jachwisunbae.property.controller.dto.request.CreatePropertyRequest;
import com.jachwisunbae.property.controller.dto.request.PropertyCommuteTimeRequest;
import com.jachwisunbae.property.controller.dto.request.UpdatePropertyMemoRequest;
import com.jachwisunbae.property.controller.dto.request.UpdatePropertyRequest;
import com.jachwisunbae.property.controller.dto.response.CreatePropertyResponse;
import com.jachwisunbae.property.controller.dto.response.PropertyCommuteTimesResponse;
import com.jachwisunbae.property.controller.dto.response.PropertyDetailResponse;
import com.jachwisunbae.property.controller.dto.response.PropertyListResponse;
import com.jachwisunbae.property.controller.dto.response.PropertyMemoResponse;
import com.jachwisunbae.property.controller.dto.response.UpdatePropertyResponse;
import com.jachwisunbae.property.entity.Property;
import com.jachwisunbae.property.service.PropertyCommuteService;
import com.jachwisunbae.property.service.PropertyDeletionService;
import com.jachwisunbae.property.service.PropertyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/properties")
@Tag(name = "Properties", description = "후보 매물 관리 API")
@SecurityRequirement(name = "bearerAuth")
public class PropertyController {
    private final PropertyService propertyService;
    private final PropertyDeletionService propertyDeletionService;
    private final PropertyCommuteService propertyCommuteService;

    public PropertyController(final PropertyService propertyService,
                              final PropertyDeletionService propertyDeletionService,
                              final PropertyCommuteService propertyCommuteService) {
        this.propertyService = propertyService;
        this.propertyDeletionService = propertyDeletionService;
        this.propertyCommuteService = propertyCommuteService;
    }

    @GetMapping
    @Operation(summary = "매물 목록 조회", description = "로그인 회원의 매물과 대표 사진 및 전체 체크 진행 현황을 조회합니다.")
    public ApiResponse<PropertyListResponse> findList(@AuthenticatedMemberId final Long memberId) {
        return ApiResponse.of("매물 목록을 조회했습니다.", propertyService.findList(memberId));
    }

    @PostMapping("/comparison-views")
    @Deprecated(forRemoval = true)
    @Operation(summary = "비교 화면 진입 기록",
            description = "현재 회원이 비교 화면을 연 시각과 그 시점의 보유 매물 수를 실험 이벤트로 저장합니다.")
    public ResponseEntity<Void> recordComparisonView(@AuthenticatedMemberId final Long memberId) {
        return ResponseEntity.noContent().build();
    }

    @PostMapping
    @Operation(summary = "매물 생성",
            description = "후보 매물을 생성합니다. 회원당 최대 30개까지 등록할 수 있습니다.")
    public ResponseEntity<ApiResponse<CreatePropertyResponse>> create(
            @AuthenticatedMemberId final Long memberId,
            @Valid @RequestBody final CreatePropertyRequest request) {
        Property property = propertyService.create(memberId, request);
        return ResponseEntity.created(URI.create("/api/properties/" + property.getId()))
                .body(ApiResponse.of("매물을 등록했습니다.", CreatePropertyResponse.from(property)));
    }

    @GetMapping("/commute-times")
    @Operation(summary = "매물별 통근 시간 조회", description = "로그인 회원의 매물마다 목적지까지 대중교통으로 걸리는 시간을 "
            + "최대 60분, 환승 2회 기준으로 조회합니다. 위치가 없는 매물은 NO_LOCATION, 60분 안에 닿지 못하면 UNREACHABLE입니다.")
    public ApiResponse<PropertyCommuteTimesResponse> findCommuteTimes(
            @AuthenticatedMemberId final Long memberId,
            @Valid @ModelAttribute final PropertyCommuteTimeRequest request) {
        return ApiResponse.of("매물별 통근 시간을 조회했습니다.", PropertyCommuteTimesResponse.from(
                propertyCommuteService.findCommuteTimes(memberId, request.destination())));
    }

    @GetMapping("/{propertyId}")
    @Operation(summary = "매물 상세 조회", description = "매물 기본 정보와 사진 및 전체 체크 진행 현황을 조회합니다.")
    public ApiResponse<PropertyDetailResponse> findDetail(
            @AuthenticatedMemberId final Long memberId,
            @PathVariable final Long propertyId) {
        return ApiResponse.of("매물 상세 정보를 조회했습니다.",
                propertyService.findDetail(memberId, propertyId));
    }

    @PutMapping("/{propertyId}")
    @Operation(summary = "매물 기본 정보 수정", description = "매물 이름과 금액 및 발견 경로를 전체 수정합니다.")
    public ApiResponse<UpdatePropertyResponse> update(
            @AuthenticatedMemberId final Long memberId,
            @PathVariable final Long propertyId,
            @Valid @RequestBody final UpdatePropertyRequest request) {
        UpdatePropertyResponse response = UpdatePropertyResponse.from(
                propertyService.update(memberId, propertyId, request));
        return ApiResponse.of("매물 정보를 수정했습니다.", response);
    }

    @DeleteMapping("/{propertyId}")
    @Operation(summary = "매물 삭제", description = "메모·체크리스트·사진 메타데이터를 포함한 매물 종속 데이터를 삭제합니다.")
    public ResponseEntity<Void> delete(
            @AuthenticatedMemberId final Long memberId,
            @PathVariable final Long propertyId) {
        propertyDeletionService.delete(memberId, propertyId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{propertyId}/memo")
    @Operation(summary = "자유 메모 조회", description = "매물의 자유 메모를 조회합니다.")
    public ApiResponse<PropertyMemoResponse> findMemo(
        @AuthenticatedMemberId final Long memberId,
        @PathVariable final Long propertyId) {
        return ApiResponse.of("자유 메모를 조회했습니다.",
            PropertyMemoResponse.of(propertyId, propertyService.findMemoByMemberIdAndPropertyId(memberId, propertyId)));
    }

    @PutMapping("/{propertyId}/memo")
    @Operation(summary = "자유 메모 교체", description = "매물의 자유 메모를 교체합니다.")
    public ApiResponse<PropertyMemoResponse> updateMemo(
        @AuthenticatedMemberId final Long memberId,
        @PathVariable final Long propertyId,
        @Valid @RequestBody final UpdatePropertyMemoRequest request) {
        return ApiResponse.of("자유 메모를 저장했습니다.",
            PropertyMemoResponse.of(propertyId, propertyService.updateMemoByMemberIdAndPropertyId(memberId, propertyId, request)));
    }
}
