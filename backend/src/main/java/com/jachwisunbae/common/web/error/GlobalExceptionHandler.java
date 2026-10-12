package com.jachwisunbae.common.web.error;

import com.jachwisunbae.common.exception.JachwiException;
import com.jachwisunbae.common.exception.client.AuthenticationFailedException;
import com.jachwisunbae.common.exception.client.AuthorizationFailedException;
import com.jachwisunbae.common.exception.client.BusinessRuleViolationException;
import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.client.ResourceNotFoundException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.DataInconsistencyException;
import com.jachwisunbae.common.exception.server.InternalSystemException;
import com.jachwisunbae.common.exception.server.ServerException;
import com.jachwisunbae.common.exception.server.UpstreamServiceException;
import com.jachwisunbae.common.observability.RequestLoggingFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(JachwiException.class)
    public ResponseEntity<ErrorResponse> handleJachwiException(
            final JachwiException exception,
            final HttpServletRequest request) {
        HttpStatus status = statusOf(exception);
        if (status.is5xxServerError()) {
            RequestLoggingFilter.recordHandledServerError(request, exception);
        }
        logJachwiException(exception, status);
        return response(status, exception.getErrorCode());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleMethodArgumentNotValid(
            final MethodArgumentNotValidException exception) {
        List<FieldErrorResponse> errors = exception.getBindingResult().getFieldErrors().stream()
                .map(this::toFieldErrorResponse)
                .toList();
        log.info("Request validation failed: errorCount={}", errors.size());
        return response(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_REQUEST, errors);
    }

    @ExceptionHandler(BindException.class)
    public ResponseEntity<ErrorResponse> handleBindException(final BindException exception) {
        List<FieldErrorResponse> errors = exception.getBindingResult().getFieldErrors().stream()
                .map(this::toFieldErrorResponse)
                .toList();
        log.info("Request binding failed: errorCount={}", errors.size());
        return response(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_REQUEST, errors);
    }

    @ExceptionHandler({HandlerMethodValidationException.class, ConstraintViolationException.class})
    public ResponseEntity<ErrorResponse> handleConstraintViolation(final Exception exception) {
        log.info("Request constraint validation failed: type={}", exception.getClass().getSimpleName());
        return response(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_REQUEST);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(
            final MethodArgumentTypeMismatchException exception) {
        FieldErrorResponse error = new FieldErrorResponse(exception.getName(), "올바른 형식의 값이 아닙니다.");
        log.info("Request argument type mismatch: field={}", exception.getName());
        return response(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_REQUEST, List.of(error));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadableMessage(
            final HttpMessageNotReadableException exception) {
        log.info("Request body is not readable: type={}", exception.getClass().getSimpleName());
        return response(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_REQUEST);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handleMissingParameter(
            final MissingServletRequestParameterException exception) {
        FieldErrorResponse error = new FieldErrorResponse(exception.getParameterName(), "필수 값입니다.");
        log.info("Required request parameter is missing: field={}", exception.getParameterName());
        return response(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_REQUEST, List.of(error));
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<ErrorResponse> handleMissingPart(final MissingServletRequestPartException exception) {
        FieldErrorResponse error = new FieldErrorResponse(exception.getRequestPartName(), "필수 값입니다.");
        log.info("Required request part is missing: field={}", exception.getRequestPartName());
        return response(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_REQUEST, List.of(error));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethodNotSupported(
            final HttpRequestMethodNotSupportedException exception) {
        log.info("Request method is not supported: method={}", exception.getMethod());
        return response(HttpStatus.METHOD_NOT_ALLOWED, ErrorCode.METHOD_NOT_ALLOWED);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMediaTypeNotSupported(
            final HttpMediaTypeNotSupportedException exception) {
        log.info("Request media type is not supported");
        return response(HttpStatus.UNSUPPORTED_MEDIA_TYPE, ErrorCode.UNSUPPORTED_MEDIA_TYPE);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleMaxUploadSize(
            final MaxUploadSizeExceededException exception) {
        log.info("Upload size limit exceeded");
        return response(HttpStatus.PAYLOAD_TOO_LARGE, ErrorCode.PHOTO_FILE_TOO_LARGE);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoResourceFound(final NoResourceFoundException exception) {
        log.info("Request resource was not found");
        return response(HttpStatus.NOT_FOUND, ErrorCode.RESOURCE_NOT_FOUND);
    }

    // 의미를 알고 처리하지 않은 예외는 모두 서버 문제로 본다.
    // 예상하지 못한 DB 제약 위반(DataIntegrityViolationException), Controller 매핑 오류(MissingPathVariableException),
    // 내부 불변식 위반(IllegalArgumentException, IllegalStateException)도 여기서 500이 된다.
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpectedException(
            final Exception exception,
            final HttpServletRequest request) {
        RequestLoggingFilter.recordHandledServerError(request, exception);
        log.error("Unexpected server error: type={}", exception.getClass().getSimpleName(), exception);
        return response(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_SERVER_ERROR);
    }

    private ResponseEntity<ErrorResponse> response(final HttpStatus status, final ErrorCode errorCode) {
        return response(status, errorCode, List.of());
    }

    // 응답 메시지는 항상 ErrorCode의 공개 메시지를 쓴다. 예외의 debugMessage는 로그에만 남긴다.
    private ResponseEntity<ErrorResponse> response(
            final HttpStatus status,
            final ErrorCode errorCode,
            final List<FieldErrorResponse> errors) {
        ErrorResponse body = new ErrorResponse(errorCode.name(), errorCode.publicMessage(), errors);
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            RequestLoggingFilter.recordErrorMessage(attributes.getRequest(), body.message());
        }
        return ResponseEntity.status(status).body(body);
    }

    private String reasonOf(final String reason) {
        if (reason == null || reason.isBlank()) {
            return "올바르지 않은 값입니다.";
        }
        return reason;
    }

    private FieldErrorResponse toFieldErrorResponse(final FieldError error) {
        if (error.isBindingFailure()) {
            return new FieldErrorResponse(error.getField(), "올바른 형식의 값이 아닙니다.");
        }
        return new FieldErrorResponse(error.getField(), reasonOf(error.getDefaultMessage()));
    }

    // 예외 타입이 HTTP 상태를 정한다. ErrorCode는 실패 이유만 나타낸다.
    private HttpStatus statusOf(final JachwiException exception) {
        return switch (exception) {
            case InvalidInputException invalidInput -> HttpStatus.BAD_REQUEST;
            case BusinessRuleViolationException ruleViolation -> HttpStatus.BAD_REQUEST;
            case AuthenticationFailedException authenticationFailed -> HttpStatus.UNAUTHORIZED;
            case AuthorizationFailedException authorizationFailed -> HttpStatus.FORBIDDEN;
            case ResourceNotFoundException notFound -> HttpStatus.NOT_FOUND;
            case DataInconsistencyException dataInconsistency -> HttpStatus.INTERNAL_SERVER_ERROR;
            case InternalSystemException internalSystem -> HttpStatus.INTERNAL_SERVER_ERROR;
            case UpstreamServiceException upstream -> HttpStatus.BAD_GATEWAY;
            // 상태를 정하지 않은 새 예외 타입은 서버 문제로 드러낸다.
            default -> HttpStatus.INTERNAL_SERVER_ERROR;
        };
    }

    // 서버가 고쳐야 하는 실패만 Stack Trace와 함께 ERROR로 남긴다.
    private void logJachwiException(final JachwiException exception, final HttpStatus status) {
        String message = "{}: code={}, status={}, debugMessage={}";
        String type = exception.getClass().getSimpleName();
        if (exception instanceof ServerException) {
            log.error(message, type, exception.getErrorCode(), status.value(), exception.getMessage(), exception);
            return;
        }
        log.info(message, type, exception.getErrorCode(), status.value(), exception.getMessage());
    }
}
