package com.jachwisunbae.common.web.error;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.jachwisunbae.common.exception.JachwiException;
import com.jachwisunbae.common.exception.client.AuthenticationFailedException;
import com.jachwisunbae.common.exception.client.AuthorizationFailedException;
import com.jachwisunbae.common.exception.client.BusinessRuleViolationException;
import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.client.ResourceNotFoundException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.DataInconsistencyException;
import com.jachwisunbae.common.exception.server.InternalSystemException;
import com.jachwisunbae.common.exception.server.UpstreamServiceException;
import com.jachwisunbae.common.observability.RequestLoggingFilter;
import java.lang.reflect.Method;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.slf4j.LoggerFactory;
import org.springframework.core.MethodParameter;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.MissingPathVariableException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.method.annotation.ExceptionHandlerMethodResolver;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

class GlobalExceptionHandlerTest {

    private static final String DEBUG_MESSAGE = "내부 원인 propertyId=7 errCd=-401";

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    static Stream<Arguments> exceptionsAndStatuses() {
        ErrorCode code = ErrorCode.PROPERTY_NOT_FOUND;
        return Stream.of(
                Arguments.of(new InvalidInputException(code, DEBUG_MESSAGE), HttpStatus.BAD_REQUEST),
                Arguments.of(new BusinessRuleViolationException(code, DEBUG_MESSAGE), HttpStatus.BAD_REQUEST),
                Arguments.of(new AuthenticationFailedException(code, DEBUG_MESSAGE), HttpStatus.UNAUTHORIZED),
                Arguments.of(new AuthorizationFailedException(code, DEBUG_MESSAGE), HttpStatus.FORBIDDEN),
                Arguments.of(new ResourceNotFoundException(code, DEBUG_MESSAGE), HttpStatus.NOT_FOUND),
                Arguments.of(new DataInconsistencyException(code, DEBUG_MESSAGE), HttpStatus.INTERNAL_SERVER_ERROR),
                Arguments.of(new InternalSystemException(code, DEBUG_MESSAGE), HttpStatus.INTERNAL_SERVER_ERROR),
                Arguments.of(new UpstreamServiceException(code, DEBUG_MESSAGE), HttpStatus.BAD_GATEWAY));
    }

    @ParameterizedTest(name = "{0} → {1}")
    @MethodSource("exceptionsAndStatuses")
    @DisplayName("예외 타입으로 HTTP 상태를 정한다")
    void mapsExceptionTypeToStatus(JachwiException exception, HttpStatus status) {
        ResponseEntity<ErrorResponse> response = handler.handleJachwiException(exception, new MockHttpServletRequest());

        assertThat(response.getStatusCode()).isEqualTo(status);
    }

    @Test
    @DisplayName("응답에는 ErrorCode와 공개 메시지만 담고 debugMessage는 노출하지 않는다")
    void respondsWithPublicMessageOnly() {
        ResponseEntity<ErrorResponse> response = handler.handleJachwiException(
                new UpstreamServiceException(ErrorCode.MAP_PROVIDER_UNAVAILABLE, DEBUG_MESSAGE),
                new MockHttpServletRequest());

        assertThat(response.getBody()).isEqualTo(new ErrorResponse(ErrorCode.MAP_PROVIDER_UNAVAILABLE.name(),
                ErrorCode.MAP_PROVIDER_UNAVAILABLE.publicMessage()));
    }

    @Test
    @DisplayName("예상하지 못한 예외는 내부 정보 없이 500으로 응답한다")
    void respondsUnexpectedExceptionAsInternalServerError() {
        ResponseEntity<ErrorResponse> response = handler.handleUnexpectedException(
                new IllegalArgumentException(DEBUG_MESSAGE), new MockHttpServletRequest());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).isEqualTo(new ErrorResponse(ErrorCode.INTERNAL_SERVER_ERROR.name(),
                ErrorCode.INTERNAL_SERVER_ERROR.publicMessage()));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("unexpectedExceptions")
    @DisplayName("예상하지 못한 DB 제약 위반과 Controller 매핑 오류는 500 처리로 넘어간다")
    void routesServerProblemsToUnexpectedHandler(Exception exception) {
        Method handlerMethod = new ExceptionHandlerMethodResolver(GlobalExceptionHandler.class)
                .resolveMethod(exception);

        assertThat(handlerMethod.getName()).isEqualTo("handleUnexpectedException");
    }

    static Stream<Exception> unexpectedExceptions() throws NoSuchMethodException {
        MethodParameter parameter = new MethodParameter(
                GlobalExceptionHandlerTest.class.getDeclaredMethod("unexpectedExceptions"), -1);
        return Stream.of(
                new DataIntegrityViolationException("unexpected constraint"),
                new DuplicateKeyException("other_unique_constraint"),
                new MissingPathVariableException("propertyId", parameter));
    }

    @Test
    @DisplayName("요청 파트가 없으면 400과 필드 오류로 응답한다")
    void respondsMissingPartAsInvalidRequest() {
        ResponseEntity<ErrorResponse> response = handler.handleMissingPart(
                new MissingServletRequestPartException("file"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().code()).isEqualTo(ErrorCode.INVALID_REQUEST.name());
        assertThat(response.getBody().errors()).containsExactly(new FieldErrorResponse("file", "필수 값입니다."));
    }

    @Test
    @DisplayName("4xx 오류 응답의 공개 메시지를 요청 로그에도 남긴다")
    void logsPublicMessageForClientError() throws Exception {
        Logger logger = (Logger) LoggerFactory.getLogger(RequestLoggingFilter.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        try {
            MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new FailingController())
                    .setControllerAdvice(handler)
                    .addFilters(new RequestLoggingFilter())
                    .build();

            mockMvc.perform(get("/logging-test/photo-limit"))
                    .andExpect(status().isBadRequest());

            assertThat(appender.list).hasSize(1);
            assertThat(appender.list.getFirst().getFormattedMessage())
                    .contains(ErrorCode.PHOTO_LIMIT_EXCEEDED.publicMessage());
        } finally {
            logger.detachAppender(appender);
            appender.stop();
        }
    }

    @RestController
    static class FailingController {

        @GetMapping("/logging-test/photo-limit")
        void photoLimit() {
            throw new BusinessRuleViolationException(ErrorCode.PHOTO_LIMIT_EXCEEDED,
                    "매물당 사진 등록 제한 초과");
        }
    }
}
