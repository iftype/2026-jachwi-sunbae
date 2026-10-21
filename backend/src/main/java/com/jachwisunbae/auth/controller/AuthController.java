package com.jachwisunbae.auth.controller;

import com.jachwisunbae.auth.controller.dto.LoginResponse;
import com.jachwisunbae.auth.service.AuthService;
import com.jachwisunbae.common.web.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Authentication", description = "닉네임 로그인과 Access Token 발급 API")
public class AuthController {

    private final AuthService service;

    public AuthController(AuthService service) {
        this.service = service;
    }

    @PostMapping("/login")
    @Operation(summary = "로그인",
            description = "첫 접속 시 회원 생성하고, 로그인합니다.")
    public ApiResponse<LoginResponse> loginAnonymous() {
        return ApiResponse.of(LoginResponse.from(service.startAnonymous()));
    }

}
