package com.jachwisunbae.auth.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jachwisunbae.auth.token.JwtTokenProvider;
import com.jachwisunbae.common.exception.client.AuthenticationFailedException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.web.error.ErrorResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.cors.CorsUtils;
import org.springframework.web.filter.OncePerRequestFilter;

//인증이 필요한 모든 HTTP 요청 앞에서 Authorization 헤더의 JWT를 검사하고,
//유효하면 memberId를 request에 넣어 다음 단계로 넘기는 필터
@Component
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    public static final String MEMBER_ID_ATTRIBUTE = "authenticatedMemberId";
    private final JwtTokenProvider provider;
    private final ObjectMapper objectMapper;

    public JwtAuthenticationFilter(JwtTokenProvider provider,
                                   ObjectMapper objectMapper) {
        this.provider = provider;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {

        if (CorsUtils.isPreFlightRequest(request) || isPublicRequest(request)) {//인증 통과
            chain.doFilter(request, response); //"내 처리가 끝났으니 다음 Filter/Controller로 넘겨라."
            return;
        }

        String authorization = request.getHeader("Authorization");
        if (!isBearerToken(authorization)) {
            writeAuthenticationError(response);
            return;
        }

        try {
            request.setAttribute(
                    MEMBER_ID_ATTRIBUTE,
                    provider.parseMemberId(extractToken(authorization)));
        } catch (AuthenticationFailedException exception) { //잘못된 jwt. 클라 문제
            writeAuthenticationError(response);
            return;
        }
        chain.doFilter(request, response);
    }

    private boolean isPublicRequest(HttpServletRequest request) {
        String path = request.getRequestURI();
        if (!path.startsWith("/api/")) {
            return true;
        }
        if (("/api/check-items".equals(path)
                || path.startsWith("/api/maps/")
                || path.startsWith("/api/guest/")) && "GET".equals(request.getMethod())) {
            return true;
        }
        return path.startsWith("/api/auth/");
    }

    private boolean isBearerToken(String authorization) {
        return authorization != null && authorization.startsWith("Bearer ")
                && authorization.length() > "Bearer ".length();
    }

    private String extractToken(String authorization) {
        return authorization.substring("Bearer ".length());
    }

    // 필터는 Controller 앞에서 동작해 GlobalExceptionHandler를 거치지 않으므로, 같은 오류 응답 형식을 직접 쓴다.
    private void writeAuthenticationError(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setCharacterEncoding("UTF-8");
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getWriter(),
                new ErrorResponse(ErrorCode.ACCESS_TOKEN_INVALID.name(),
                        ErrorCode.ACCESS_TOKEN_INVALID.publicMessage()));
    }
}
