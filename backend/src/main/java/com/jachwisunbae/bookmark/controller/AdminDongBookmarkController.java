package com.jachwisunbae.bookmark.controller;

import com.jachwisunbae.auth.web.AuthenticatedMemberId;
import com.jachwisunbae.bookmark.controller.dto.request.AddAdminDongBookmarkRequest;
import com.jachwisunbae.bookmark.controller.dto.response.AdminDongBookmarkResponse;
import com.jachwisunbae.bookmark.controller.dto.response.AdminDongBookmarksResponse;
import com.jachwisunbae.bookmark.service.AdminDongBookmarkService;
import com.jachwisunbae.common.web.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin-dong-bookmarks")
@SecurityRequirement(name = "bearerAuth")
public class AdminDongBookmarkController {

    private final AdminDongBookmarkService bookmarkService;

    public AdminDongBookmarkController(final AdminDongBookmarkService bookmarkService) {
        this.bookmarkService = bookmarkService;
    }

    @PostMapping
    @Operation(summary = "동네 북마크 추가",
            description = "인증된 회원이 행정동을 북마크합니다. 이미 북마크한 행정동이면 그대로 201을 응답합니다. "
            + "8자리 숫자가 아니거나 적재되지 않은 행정동 코드는 ADMIN_DONG_BOOKMARK_INVALID(400)로 응답합니다.")
    public ResponseEntity<ApiResponse<AdminDongBookmarkResponse>> add(
            @AuthenticatedMemberId final Long memberId,
            @Valid @RequestBody final AddAdminDongBookmarkRequest request) {
        String adminDongCode = bookmarkService.add(memberId, request.adminDongCode());
        return ResponseEntity.created(URI.create("/api/admin-dong-bookmarks/" + adminDongCode))
                .body(ApiResponse.of("동네를 북마크했습니다.", new AdminDongBookmarkResponse(adminDongCode)));
    }

    @GetMapping
    @Operation(summary = "내 동네 북마크 조회",
            description = "현재 회원이 북마크한 행정동 코드를 최근에 추가한 순서로 모두 조회합니다. 없으면 빈 배열입니다.")
    public ApiResponse<AdminDongBookmarksResponse> findAll(@AuthenticatedMemberId final Long memberId) {
        return ApiResponse.of("북마크한 동네를 조회했습니다.",
                new AdminDongBookmarksResponse(bookmarkService.findCodes(memberId)));
    }

    @DeleteMapping("/{adminDongCode}")
    @Operation(summary = "동네 북마크 해제",
            description = "현재 회원의 북마크를 해제합니다. 북마크하지 않았거나 이미 해제한 행정동은 "
            + "ADMIN_DONG_BOOKMARK_NOT_FOUND(404)로 응답합니다.")
    public ResponseEntity<Void> remove(
            @AuthenticatedMemberId final Long memberId,
            @PathVariable final String adminDongCode) {
        bookmarkService.remove(memberId, adminDongCode);
        return ResponseEntity.noContent().build();
    }
}
