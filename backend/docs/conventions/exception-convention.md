# 예외 컨벤션

## 1. 목적

이 문서는 자취선배 백엔드에서 실패 상황을 일관되게 표현하고 처리하는 기준을 정의한다.

예외 처리의 목적은 HTTP 상태 코드를 반환하는 것만이 아니다. 다음 질문에 일관되게 답할 수 있어야 한다.

- 이 실패는 사용자가 요청을 수정하면 해결할 수 있는가?
- 서버 코드나 데이터를 수정해야 하는 문제인가?
- 외부 시스템의 실패인가?
- 클라이언트는 어떤 `code`를 기준으로 후속 동작을 결정하는가?
- 운영자는 로그에서 원인을 추적할 수 있는가?
- 내부 정보나 민감한 값이 클라이언트에 노출되지 않는가?

같은 의미의 실패는 발생 위치와 관계없이 같은 종류의 예외와 오류 코드로 표현한다.

## 2. 핵심 원칙

### 2.1. 누가 무엇을 바꾸어야 해결되는지를 기준으로 분류한다

예외 클래스 이름이나 발생 위치보다 다음 질문을 먼저 판단한다.

> 이 실패를 해결하려면 누가 무엇을 바꾸어야 하는가?

**Client Exception**: 사용자가 요청을 수정하거나 다른 요청을 보내면 해결할 수 있는 실패다.

- 닉네임 길이가 정책에 맞지 않는다.
- 존재하지 않는 매물을 요청한다.
- 비밀번호가 일치하지 않는다.

**Server Exception**: 사용자가 요청을 수정해도 해결할 수 없는 실패다.

- DB 데이터가 애플리케이션 불변식을 만족하지 않는다.
- PDF 렌더링에 필요한 서버 리소스가 없다.
- 외부 지도 API가 실패한다.

### 2.2. 클라이언트는 `message`가 아니라 `code`로 오류를 구분한다

오류 응답의 `code`는 프론트엔드와 백엔드 사이의 API 계약이다. `message`는 사용자에게 보여줄 수 있는 안전한 안내 문구이며 바뀔 수 있다.

### 2.3. 내부 정보는 응답에 노출하지 않는다

다음 정보는 오류 응답에 포함하지 않는다.

- Java 예외 클래스명, Stack Trace, SQL
- DB 제약 이름, 외부 API 원본 오류 응답
- 서버 파일 경로, API Key, 비밀번호 등 민감한 값

원인 추적에 필요한 정보는 응답이 아니라 서버 로그에 기록한다.

### 2.4. 예상한 실패와 예상하지 못한 실패를 구분한다

애플리케이션이 의미를 알고 있는 실패만 애플리케이션 예외로 변환한다.

`NullPointerException`, `IndexOutOfBoundsException` 같은 프로그래밍 오류를 `INVALID_REQUEST`, `MAP_PROVIDER_UNAVAILABLE` 같은 알려진 오류로 숨기지 않는다. 예상하지 못한 예외는 최종적으로 `500 INTERNAL_SERVER_ERROR`로 처리한다.

## 3. 예외 구조

```text
common
├── exception
│   ├── JachwiException
│   ├── client
│   │   ├── ClientException
│   │   ├── InvalidInputException
│   │   ├── BusinessRuleViolationException
│   │   ├── ResourceNotFoundException
│   │   ├── AuthenticationFailedException
│   │   └── AuthorizationFailedException
│   ├── server
│   │   ├── ServerException
│   │   ├── DataInconsistencyException
│   │   ├── InternalSystemException
│   │   └── UpstreamServiceException
│   └── errorcode
│       └── ErrorCode
└── web
    └── error
        ├── ErrorResponse
        ├── FieldErrorResponse
        └── GlobalExceptionHandler
```

`JachwiException`은 애플리케이션이 의미를 알고 처리하는 예외의 최상위 타입이며, `ClientException`과 `ServerException`이 이를 상속한다.

오류 하나마다 예외 클래스를 만들지 않는다. **예외 타입은 실패의 분류**를, **`ErrorCode`는 구체적인 실패 이유**를 나타낸다.

```java
throw new ResourceNotFoundException(ErrorCode.PROPERTY_NOT_FOUND,
        "propertyId=" + propertyId + " 매물을 찾지 못했습니다.");

throw new ResourceNotFoundException(ErrorCode.MEMBER_NOT_FOUND,
        "memberId=" + memberId + " 회원을 찾지 못했습니다.");
```

## 4. JachwiException

모든 애플리케이션 예외는 `ErrorCode`와 내부 디버깅 메시지(`debugMessage`)를 가진다.

```java
public abstract class JachwiException extends RuntimeException {

    private final ErrorCode errorCode;

    protected JachwiException(ErrorCode errorCode, String debugMessage) {
        super(debugMessage);
        this.errorCode = errorCode;
    }

    protected JachwiException(ErrorCode errorCode, String debugMessage, Throwable cause) {
        super(debugMessage, cause);
        this.errorCode = errorCode;
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }
}
```

`debugMessage`는 개발자가 로그에서 원인을 찾기 위한 값이며 응답 메시지로 쓰지 않는다.

## 5. Client Exception

### 5.1. InvalidInputException (400)

사용자가 보낸 값이 제품에서 허용하는 형식이나 범위를 만족하지 않을 때 사용한다.

- 닉네임이 1~30자가 아니다.
- 좌표나 반경이 허용 범위를 벗어난다.

```java
throw new InvalidInputException(ErrorCode.NICKNAME_INVALID, "닉네임은 trim 후 1~30자여야 합니다.");
```

### 5.2. BusinessRuleViolationException (400)

요청 형식은 올바르지만 현재 제품 정책상 수행할 수 없는 요청일 때 사용한다.

- 회원당 매물·사진 개수 제한을 초과한다.
- 이미 추가한 체크 항목을 다시 추가한다.

자취선배는 상태 충돌을 표현하기 위해 `409 Conflict`를 사용하지 않는다. 클라이언트는 HTTP 상태보다 구체적인 `ErrorCode`로 원인을 구분한다.

### 5.3. ResourceNotFoundException (404)

요청한 리소스를 찾을 수 없을 때 사용한다. 다른 회원의 리소스도 존재를 드러내지 않도록 `404`로 응답한다.

```java
throw new ResourceNotFoundException(ErrorCode.PROPERTY_NOT_FOUND,
        "propertyId=" + propertyId + " 매물을 찾지 못했습니다.");
```

### 5.4. AuthenticationFailedException (401)

사용자의 인증 정보를 확인할 수 없을 때 사용한다.

- 보호 회원의 비밀번호가 일치하지 않는다.
- Access Token이 없거나 만료되었거나 서명·issuer·audience·subject가 유효하지 않다.

토큰 오류는 원인을 클라이언트에 구분해 노출하지 않고 `ACCESS_TOKEN_INVALID`로 통일한다. 만료, 서명 실패 같은 상세 원인은 서버 내부에서만 구분한다.

프론트엔드는 `401`을 받으면 로그인을 종료한다. 따라서 서버 코드 문제를 `401`로 응답하지 않는다. 예를 들어 인증이 필요 없는 경로의 Controller에 `@AuthenticatedMemberId`를 잘못 붙여 회원 ID가 없는 경우는 서버 문제이므로 `500`이다.

### 5.5. AuthorizationFailedException (403)

인증은 되었지만 요청한 작업을 수행할 권한이 없을 때 사용한다.

## 6. Server Exception

### 6.1. DataInconsistencyException (500)

DB에 저장된 데이터가 애플리케이션이 기대하는 상태를 만족하지 않거나, 예상하지 못한 데이터 무결성 문제가 발생했을 때 사용한다.

- DB에서 복원한 값이 도메인 불변식을 만족하지 않는다.
- 저장된 비밀번호 해시가 손상되어 검증할 수 없다.

사용자가 요청을 다시 보내도 해결되지 않는 DB 문제를 `400`으로 응답하지 않는다.

### 6.2. InternalSystemException (500)

외부 시스템과 관계없는 서버 내부 작업이 실패했을 때 사용한다.

- PDF 렌더링 실패, 필수 Classpath Resource 없음
- 서버 내부 파일 처리 실패

### 6.3. UpstreamServiceException (502)

자취선배가 의존하는 외부 시스템이 정상적인 결과를 제공하지 못했을 때 사용한다.

- Kakao Local, 행정안전부 주소, SGIS API 실패
- S3 요청 실패

외부 시스템이 HTTP 4xx를 반환해도 자취선배 사용자의 잘못이라는 뜻은 아니다. 예를 들어 서버의 API Key가 잘못되어 외부 API가 `401`을 반환했다면 사용자의 인증 실패가 아니라 서버 또는 외부 의존성 문제다. 외부 응답 상태를 클라이언트에 그대로 전달하지 않는다.

### 6.4. UpstreamTimeoutException (504, 미도입)

외부 시스템의 연결·응답 시간 초과를 일반적인 실패와 운영에서 구분해야 할 때 도입한다. 그전까지 timeout은 `UpstreamServiceException`으로 처리한다.

## 7. 도메인 불변식과 사용자 입력

도메인 객체는 자신의 유효한 상태를 스스로 보장한다. 하지만 같은 불변식 위반이라도 값의 출처에 따라 의미가 다르다.

```text
사용자가 닉네임 31자를 입력한다       → Client Error (400)
DB에 저장된 닉네임이 31자다          → Server Error (500)
```

"도메인의 `IllegalArgumentException`은 전부 500"이나 "도메인 검증 실패는 전부 400"처럼 한 가지로 정하지 않는다.

### 7.1. 사용자 입력을 표현하는 Value Object

사용자 입력을 검증하는 Value Object는 클라이언트 오류를 직접 표현할 수 있다.

```java
throw new InvalidInputException(ErrorCode.NICKNAME_INVALID, "닉네임은 1자 이상 30자 이하여야 합니다.");
```

### 7.2. DB 데이터 복원

Repository가 DB 데이터를 도메인 객체로 복원하다가 `ClientException`이 발생하면 그대로 클라이언트 오류로 전달하지 않는다. DB 데이터가 제품 규칙을 만족하지 않는 것은 사용자 요청 문제가 아니라 서버 데이터의 불일치다.

```text
도메인 복원 실패 → Repository 경계에서 DataInconsistencyException으로 변환 → 500
```

### 7.3. 내부 불변식

사용자의 요청값과 직접 관계없는 내부 불변식은 `IllegalArgumentException` 또는 `IllegalStateException`으로 표현할 수 있다. 이 예외가 `GlobalExceptionHandler`까지 도달하면 설계 또는 프로그래밍 오류로 보고 `500`으로 처리한다. raw `IllegalArgumentException`을 `400`으로 매핑하지 않는다.

애플리케이션 기동 시 설정 값 검증(API Key 누락, JWT 비밀키 길이 등)도 `IllegalStateException`으로 기동을 멈춘다.

## 8. ErrorCode

`ErrorCode`는 클라이언트와 서버 사이의 안정적인 오류 식별자이며, 클라이언트에 공개할 수 있는 `publicMessage`를 가진다.

```java
public enum ErrorCode {

    INVALID_REQUEST("요청 값을 확인해 주세요."),

    NICKNAME_INVALID("닉네임을 확인해 주세요."),
    NICKNAME_PASSWORD_INVALID("비밀번호를 확인해 주세요."),
    NICKNAME_AUTHENTICATION_FAILED("닉네임 또는 비밀번호를 확인해 주세요."),
    ACCESS_TOKEN_INVALID("인증 정보를 확인할 수 없습니다."),

    PROPERTY_NOT_FOUND("매물을 찾을 수 없습니다."),

    MAP_QUERY_INVALID("지도 요청 값을 확인해 주세요."),
    MAP_ADDRESS_NOT_FOUND("해당 위치의 주소를 찾을 수 없습니다."),
    MAP_PROVIDER_UNAVAILABLE("지도 정보를 불러오지 못했습니다."),

    INTERNAL_SERVER_ERROR("서버 내부 오류가 발생했습니다.");

    private final String publicMessage;

    ErrorCode(String publicMessage) {
        this.publicMessage = publicMessage;
    }

    public String publicMessage() {
        return publicMessage;
    }
}
```

도메인 오류뿐 아니라 요청 검증(`INVALID_REQUEST`), Spring MVC(`METHOD_NOT_ALLOWED` 등), 예상하지 못한 오류(`INTERNAL_SERVER_ERROR`)의 코드도 `ErrorCode`에서 관리한다. 전체 목록은 `ErrorCode.java`를 기준으로 한다.

### 8.1. 이름 규칙

오류 코드는 `UPPER_SNAKE_CASE`를 사용하며 가능하면 `도메인_상태` 형식을 사용한다. HTTP나 기술 구현보다 서비스에서 의미 있는 실패 이유를 이름으로 쓴다.

```text
PROPERTY_NOT_FOUND
PROPERTY_LIMIT_EXCEEDED
NICKNAME_INVALID
MAP_PROVIDER_UNAVAILABLE
```

### 8.2. ErrorCode에는 HTTP 상태를 넣지 않는다

`ErrorCode`는 실패 이유를 나타내고, HTTP 변환은 예외 타입이 결정한다. Service와 도메인은 HTTP 상태 코드를 알지 않는다.

### 8.3. publicMessage와 debugMessage를 구분한다

| 구분                      | 용도                                | 예                               |
| ------------------------- | ----------------------------------- | -------------------------------- |
| `ErrorCode.publicMessage` | 클라이언트에 공개하는 안전한 문구   | 지도 정보를 불러오지 못했습니다. |
| 예외의 `debugMessage`     | 로그에서 원인을 찾기 위한 상세 정보 | SGIS geocode failed: errCd=-401  |

응답에는 `publicMessage`만 쓴다. 로그에는 필요한 경우 `debugMessage`와 `cause`를 기록한다.

## 9. ErrorCode 변경 규칙

`ErrorCode`는 API 계약이므로 다음 변경은 프론트엔드 영향을 확인한다.

| 구분          | 변경                                                               |
| ------------- | ------------------------------------------------------------------ |
| 호환 가능     | 새 `ErrorCode` 추가, `publicMessage` 문구 변경                     |
| API 계약 변경 | 기존 `ErrorCode` 삭제·이름 변경·의미 변경, 반환되는 HTTP 상태 변경 |

API 계약을 바꿀 때는 다음을 확인한다.

1. 프론트엔드에서 해당 코드를 사용하는지 검색한다.
2. 구현과 프론트엔드 처리를 같은 작업 단위에서 수정하거나 사전에 공유한다.
3. Swagger의 대표 오류도 함께 수정한다.

## 10. HTTP 상태 코드

| 상황                     | HTTP 상태                    |
| ------------------------ | ---------------------------- |
| 입력 형식·값 오류        | `400 Bad Request`            |
| 비즈니스 규칙 위반       | `400 Bad Request`            |
| 인증 실패                | `401 Unauthorized`           |
| 권한 없음                | `403 Forbidden`              |
| 리소스 없음              | `404 Not Found`              |
| 지원하지 않는 Method     | `405 Method Not Allowed`     |
| Body가 너무 큼           | `413 Payload Too Large`      |
| 지원하지 않는 Media Type | `415 Unsupported Media Type` |
| 서버 내부 오류           | `500 Internal Server Error`  |
| 외부 시스템 실패         | `502 Bad Gateway`            |

`409 Conflict`는 사용하지 않는다. 사용자가 요청을 바꿔 해결할 수 있는 상태 충돌이나 중복은 구체적인 `ErrorCode`와 `400`으로 표현한다.

## 11. 오류 응답

```json
{
  "code": "PROPERTY_NOT_FOUND",
  "message": "매물을 찾을 수 없습니다.",
  "errors": []
}
```

| 필드      | 의미                                                                |
| --------- | ------------------------------------------------------------------- |
| `code`    | 클라이언트가 오류를 식별하는 안정적인 코드                          |
| `message` | 사용자에게 공개할 수 있는 안전한 메시지 (`ErrorCode.publicMessage`) |
| `errors`  | 요청 검증의 필드별 오류. 그 외 오류에서는 빈 배열                   |

### 11.1. 검증 오류

Bean Validation, 요청 역직렬화 등 HTTP 입력 검증 오류는 공통 코드 `INVALID_REQUEST`를 사용한다.

```json
{
  "code": "INVALID_REQUEST",
  "message": "요청 값을 확인해 주세요.",
  "errors": [
    {
      "field": "nickname",
      "reason": "필수 값입니다."
    }
  ]
}
```

### 11.2. 입력한 값을 응답하지 않는다

검증 오류에는 `field`와 `reason`만 반환하고, 사용자가 입력한 값(`rejectedValue`)은 포함하지 않는다. 그래서 비밀번호, 토큰, 메모처럼 민감한 필드를 따로 골라 가리는 구조가 필요 없다.

## 12. GlobalExceptionHandler

Controller 이후 발생한 예외의 HTTP 변환은 `@RestControllerAdvice` 한 곳에서 수행한다. Controller나 Service에서 `ResponseEntity`로 오류를 직접 반환하지 않는다.

### 12.1. JachwiException

예외 타입으로 HTTP 상태를 정하고, 응답 메시지는 `ErrorCode.publicMessage`를 쓴다.

| 예외                             | HTTP 상태 |
| -------------------------------- | --------- |
| `InvalidInputException`          | `400`     |
| `BusinessRuleViolationException` | `400`     |
| `AuthenticationFailedException`  | `401`     |
| `AuthorizationFailedException`   | `403`     |
| `ResourceNotFoundException`      | `404`     |
| `DataInconsistencyException`     | `500`     |
| `InternalSystemException`        | `500`     |
| `UpstreamServiceException`       | `502`     |

### 12.2. 예상하지 못한 예외

명시적으로 처리하지 않은 예외는 `@ExceptionHandler(Exception.class)`에서 공통 `500`으로 처리한다. 원본 예외 정보는 응답에 넣지 않고 서버 로그에 Stack Trace를 기록한다.

```json
{
  "code": "INTERNAL_SERVER_ERROR",
  "message": "서버 내부 오류가 발생했습니다.",
  "errors": []
}
```

## 13. Spring MVC 예외

Spring MVC가 Controller 호출 전후에 발생시키는 예외도 공통 오류 응답 형식으로 변환한다.

| 예외                                                                                                                                                                                                                                                                              | HTTP 상태 | 오류 코드                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------ |
| `MethodArgumentNotValidException`, `BindException`, `HandlerMethodValidationException`, `ConstraintViolationException`, `MethodArgumentTypeMismatchException`, `HttpMessageNotReadableException`, `MissingServletRequestParameterException`, `MissingServletRequestPartException` | `400`     | `INVALID_REQUEST`        |
| `HttpRequestMethodNotSupportedException`                                                                                                                                                                                                                                          | `405`     | `METHOD_NOT_ALLOWED`     |
| `MaxUploadSizeExceededException`                                                                                                                                                                                                                                                  | `413`     | `PHOTO_FILE_TOO_LARGE`   |
| `HttpMediaTypeNotSupportedException`                                                                                                                                                                                                                                              | `415`     | `UNSUPPORTED_MEDIA_TYPE` |
| `NoResourceFoundException` (존재하지 않는 API 경로)                                                                                                                                                                                                                               | `404`     | `RESOURCE_NOT_FOUND`     |
| `MissingPathVariableException`                                                                                                                                                                                                                                                    | `500`     | `INTERNAL_SERVER_ERROR`  |

- 요청 검증 오류는 가능한 경우 `field`, `reason`을 `errors`에 넣는다.
- 업로드 크기 제한은 사진 업로드에만 걸리므로 `PHOTO_FILE_TOO_LARGE`를 쓴다.
- `MissingPathVariableException`은 클라이언트가 값을 빠뜨린 것이 아니라 Controller 매핑과 메서드 선언이 맞지 않는 서버 코드 문제다.
- `RESOURCE_NOT_FOUND`는 존재하지 않는 API 경로이며, 특정 리소스가 없는 `PROPERTY_NOT_FOUND` 등과 구분한다.

## 14. DB 예외

DB 예외를 곧바로 클라이언트의 비즈니스 오류로 해석하지 않는다.

### 14.1. 예상한 DB 충돌

DB 제약을 동시성 제어나 제품 규칙의 마지막 안전장치로 사용할 수 있다. 애플리케이션이 그 상황의 의미를 정확히 알고 있다면 Service 또는 Repository 경계에서 명시적으로 처리한다.

```text
같은 닉네임의 공유 회원을 동시에 생성한다
→ INSERT에서 DuplicateKeyException
→ 같은 닉네임·보호 여부의 회원이 실제로 있는지 확인
→ 있으면 동시 생성으로 보고 그 회원으로 로그인
→ 없으면 다른 제약 위반이므로 그대로 던진다
```

DB 예외 메시지나 드라이버 오류 문구를 파싱해서 제약 종류를 판단하지 않는다.

### 14.2. 예상하지 못한 DB 제약 위반

예상한 상황으로 처리되지 않은 DB 무결성 오류(`DataIntegrityViolationException`)는 서버 문제이므로 `500 INTERNAL_SERVER_ERROR`로 처리한다.

## 15. 외부 API 예외

외부 API Client는 외부 시스템과의 통신 실패를 애플리케이션이 이해할 수 있는 서버 예외로 변환한다. 대상은 Kakao, SGIS, 행정안전부 주소 API, S3 등이다.

### 15.1. RuntimeException 전체를 외부 장애로 변환하지 않는다

다음 코드는 사용하지 않는다.

```java
try {
    ...
} catch (RuntimeException exception) {
    throw new UpstreamServiceException(...);
}
```

이렇게 하면 `NullPointerException`, 잘못된 숫자 변환 같은 우리 코드의 버그까지 외부 장애로 숨긴다.

외부 Client는 통신 라이브러리에서 발생하는 예상 가능한 예외만 골라서 변환한다.

- HTTP 오류 응답, 연결 실패, 응답 시간 초과, 응답 역직렬화 실패 (`RestClientException`)

예상하지 못한 프로그래밍 오류는 그대로 전파해 `500`으로 드러나게 한다.

### 15.2. 외부 응답의 비정상 데이터

외부 API가 HTTP 200을 반환해도 서비스에 필요한 데이터를 제공하지 않았다면 따로 판단한다.

| 상황                                             | 처리                                            |
| ------------------------------------------------ | ----------------------------------------------- |
| SGIS가 성공 응답했지만 좌표 형식이 잘못됨        | `UpstreamServiceException`                      |
| Kakao의 특정 장소 하나에서 필수 필드가 누락됨    | 그 장소만 제외할 수 있다면 제외하고 `WARN` 로그 |
| 응답 전체 구조가 깨져 사용할 수 있는 결과가 없음 | `UpstreamServiceException`                      |

부분 실패를 무시할지 전체 요청을 실패시킬지는 기능별 제품 정책으로 정한다.

## 16. 대체 처리 (Fallback)

외부 시스템이 실패해도 일부 기능만 제외하고 정상 결과를 반환할 수 있다. 예를 들어 주요 결과는 성공했지만 부가 정보를 주는 외부 API가 실패하면, 제품 정책에 따라 부가 정보 없이 결과를 제공할 수 있다.

이때 **예상한 외부 장애만** 잡는다.

```java
try {
    supplementProvider.find(...);
} catch (UpstreamServiceException exception) {
    log.warn(...);
}
```

우리 DB에서 조회하는 데이터는 외부 장애가 아니므로 대체 처리하지 않는다. 예를 들어 버스정류장은 서비스 DB에서 조회하므로, 조회가 실패하면 그대로 `500`으로 드러낸다.

`catch (RuntimeException)`으로 모든 예외를 잡아 우리 코드의 `NullPointerException`까지 대체 처리로 숨기지 않는다.

## 17. 인증 Filter

`JwtAuthenticationFilter`는 Controller보다 앞에서 동작하므로 `GlobalExceptionHandler`에 도달하지 않는다. 그래서 인증 실패 응답을 Filter가 직접 작성한다. 응답 형식과 `ErrorCode` 정책은 `GlobalExceptionHandler`와 같게 유지한다.

```json
{
  "code": "ACCESS_TOKEN_INVALID",
  "message": "인증 정보를 확인할 수 없습니다.",
  "errors": []
}
```

| 상황                                       | HTTP 상태 | 오류 코드              |
| ------------------------------------------ | --------- | ---------------------- |
| Access Token 누락, Bearer가 아닌 인증 방식 | `401`     | `ACCESS_TOKEN_INVALID` |
| Access Token 만료                          | `401`     | `ACCESS_TOKEN_INVALID` |
| 서명·issuer·audience·subject·형식 오류     | `401`     | `ACCESS_TOKEN_INVALID` |

응답 작성 로직은 사용처가 Filter 하나뿐이므로 Filter 안에 둔다. 재사용이 필요해지면 별도 객체로 분리한다.

## 18. 계층별 예외 책임

| 계층                 | 책임                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Service              | 유스케이스의 의미를 알고 있으므로 비즈니스 정책 위반을 판단해 `JachwiException`으로 표현한다. `HttpStatus`, `ResponseEntity`를 알지 않는다. |
| Repository           | DB 접근과 복원을 담당하고 DB 문제를 애플리케이션이 이해할 수 있는 형태로 바꾼다. 예: 복원 실패 → `DataInconsistencyException`               |
| 외부 Client, Storage | 외부 라이브러리 예외가 Service까지 퍼지지 않도록 경계에서 `UpstreamServiceException`으로 바꾼다.                                            |

## 19. 예외를 잡는 규칙

예외는 다음 경우에만 잡는다.

1. 더 의미 있는 애플리케이션 예외로 바꿀 수 있을 때
2. 대체 처리라는 명확한 제품 정책이 있을 때
3. 보상 작업이나 리소스 정리가 필요할 때
4. 경계에서 로그를 남기고 반드시 다시 던질 때

오류가 발생하지 않은 것처럼 만들기 위해 잡지 않는다.

다른 예외를 잡아 바꿔 던질 때는 원래 예외를 `cause`로 넘긴다. 지금 로그에 쓰이지 않더라도 원인을 잃지 않기 위해서다. 직접 조건을 검사해 발견한 실패에는 넘길 원인 예외가 없다.

```java
try {
    return SignedJWT.parse(token);
} catch (ParseException exception) {
    throw new AuthenticationFailedException(ErrorCode.ACCESS_TOKEN_INVALID,
            "JWT 형식이 올바르지 않습니다.", exception);
}
```

## 20. 판단 순서

새로운 실패 상황을 발견하면 다음 순서로 판단한다.

```text
1. 사용자가 요청을 바꾸면 해결되는가?
   ├─ Yes → ClientException
   └─ No ↓
2. 외부 시스템의 실패인가?
   ├─ Yes → UpstreamServiceException
   └─ No ↓
3. 저장된 데이터의 불일치인가?
   ├─ Yes → DataInconsistencyException
   └─ No ↓
4. 서버 내부 작업의 실패인가?
   ├─ Yes → InternalSystemException
   └─ 의미를 알 수 없음 ↓
5. 잡지 않는다 → 500 INTERNAL_SERVER_ERROR
```

## 21. 예시

| 상황                               | 흐름                                                                            | 결과  |
| ---------------------------------- | ------------------------------------------------------------------------------- | ----- |
| 잘못된 닉네임                      | `Nickname` → `InvalidInputException(NICKNAME_INVALID)`                          | `400` |
| 틀린 비밀번호                      | `AuthService` → `AuthenticationFailedException(NICKNAME_AUTHENTICATION_FAILED)` | `401` |
| 손상된 DB 비밀번호 해시            | 저장된 해시 검증 실패 → `DataInconsistencyException`                            | `500` |
| 존재하지 않는 매물                 | `PropertyService` → `ResourceNotFoundException(PROPERTY_NOT_FOUND)`             | `404` |
| SGIS 장애                          | `SgisAddressClient` → `UpstreamServiceException(MAP_PROVIDER_UNAVAILABLE)`      | `502` |
| 우리 코드의 `NullPointerException` | 잡지 않음 → `GlobalExceptionHandler`                                            | `500` |

### 하지 않는 것

| 하지 않는 것                                            | 이유                                           |
| ------------------------------------------------------- | ---------------------------------------------- |
| `catch (RuntimeException)` → `InvalidInputException`    | 서버 버그를 사용자 입력 오류로 숨긴다          |
| `catch (RuntimeException)` → `UpstreamServiceException` | 서버 버그를 외부 장애로 숨긴다                 |
| `DataIntegrityViolationException` → `409`               | 원인을 모르는 DB 오류를 사용자 문제로 응답한다 |
| `new ErrorResponse(code, exception.getMessage())`       | 내부 디버깅 메시지가 응답에 노출된다           |

## 22. 향후 정리할 항목

- **로그 정책**: Client Exception은 Stack Trace 없이 `INFO`, Server Exception은 Stack Trace와 함께 `ERROR`, 대체 처리한 외부 장애는 `WARN`. 요청 로그와 연결하도록 `request_id`, `error_code`, `exception_type`, `upstream`을 구조화해 기록한다.
- **예외 테스트**: 예외 타입별 HTTP 상태, 요청 검증, Spring MVC 예외, 인증 Filter, 외부 API 실패 유형, 모든 `ErrorCode`의 `publicMessage` 존재 여부
- **Swagger 문서화**: 요청 검증 오류, API별 대표 Client Error, 인증 필요 여부, 주요 Server Error를 문서화하고 모든 내부 예외를 나열하지 않는다.
