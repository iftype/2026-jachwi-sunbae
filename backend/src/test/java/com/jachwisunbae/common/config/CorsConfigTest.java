package com.jachwisunbae.common.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class CorsConfigTest {

    private static final String FRONTEND_ORIGIN = "https://dev.jachwi-sunbae.kr";

    @Test
    void 리프레시_쿠키를_보내는_교차_출처_요청에_자격_증명을_허용한다() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/refresh");
        request.addHeader("Origin", FRONTEND_ORIGIN);
        MockHttpServletResponse response = new MockHttpServletResponse();

        new CorsConfig(List.of(FRONTEND_ORIGIN)).corsFilter().getFilter()
                .doFilter(request, response, new MockFilterChain());

        assertThat(response.getHeader("Access-Control-Allow-Origin")).isEqualTo(FRONTEND_ORIGIN);
        assertThat(response.getHeader("Access-Control-Allow-Credentials")).isEqualTo("true");
    }
}
