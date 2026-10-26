package com.jachwisunbae.auth.controller;

import com.jachwisunbae.auth.controller.dto.LoginResponse;
import com.jachwisunbae.auth.service.AuthService;
import com.jachwisunbae.auth.service.dto.LoginResult;
import com.jachwisunbae.common.web.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Authentication", description = "익명 회원 생성, 인증 복원과 토큰 갱신 API")
public class AuthController {

    private final AuthService service;

    public AuthController(AuthService service) {
        this.service = service;
    }

    @PostMapping("/login")
    @Operation(summary = "로그인",
            description = "유효한 Refresh 쿠키로 기존 회원을 복원합니다. 쿠키가 없거나 만료·삭제되었거나 "
                    + "정상 회원을 찾을 수 없으면 새 익명 회원을 생성합니다. Access Token은 필요하지 않습니다.")
    public ApiResponse<LoginResponse> loginAnonymous(
            @CookieValue(name = "refresh_token", required = false) String rawToken,
            HttpServletResponse response) {
        return respondWithCookie(service.startAnonymous(rawToken), response);
    }

    @PostMapping("/refresh")
    @Operation(summary = "토큰 갱신",
            description = "Refresh 쿠키가 유효하고 정상 회원과 연결되어 있으면 유효기간을 연장하고 "
                    + "Access Token을 재발급합니다. 인증 복원이 불가능하면 401 REFRESH_TOKEN_INVALID를 응답하며 "
                    + "새 회원을 생성하지 않습니다. Access Token은 필요하지 않습니다.")
    public ApiResponse<LoginResponse> refresh(
            @CookieValue(name = "refresh_token", required = false) String rawToken,
            HttpServletResponse response) {
        return respondWithCookie(service.refresh(rawToken), response);
    }

    private ApiResponse<LoginResponse> respondWithCookie(LoginResult loginResult, HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie
                .from("refresh_token", loginResult.refreshToken())
                .httpOnly(true)
                .secure(true)
                .sameSite("Lax")
                .path("/api/auth")
                .maxAge(loginResult.refreshTokenExpiresIn())
                .build();

        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        return ApiResponse.of(LoginResponse.from(loginResult));
    }

}
