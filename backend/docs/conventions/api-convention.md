# API 컨벤션

## 설계와 문서화

- 구현 전에 팀 협업 공간에서 경로, 요청, 응답과 대표 오류를 합의한다.
- 합의한 계약을 구현하고 Swagger/OpenAPI에서 실제 결과를 확인한다.
- 저장소에는 별도의 API 명세 Markdown 문서를 두지 않는다.
- 합의한 계약과 구현이 다르면 같은 PR에서 코드와 Swagger를 수정한다.

## URL과 HTTP Method

URL은 `/api`로 시작하고 복수형 리소스 명사를 사용한다.

```text
GET    /api/properties
GET    /api/properties/{propertyId}
POST   /api/properties
PATCH  /api/properties/{propertyId}
DELETE /api/properties/{propertyId}
```

행위 중심 URL은 사용하지 않는다.

```text
POST /api/create-property       금지
POST /api/properties/create     금지
GET  /api/get-properties        금지
```

| Method   | 용도      |
| -------- | --------- |
| `GET`    | 조회      |
| `POST`   | 생성      |
| `PATCH`  | 일부 수정 |
| `PUT`    | 전체 교체 |
| `DELETE` | 삭제      |

검색·필터·정렬·페이징은 Query Parameter를 사용한다.

```text
GET /api/properties?status=VISITED&page=0&size=20
```

## 이름 규칙

- URL은 `kebab-case`를 사용한다. 예: `member-profiles`, `visit-records`
- JSON 필드는 `lowerCamelCase`를 사용한다.
- 식별자는 `id` 대신 의미를 포함한다.

```text
propertyId
memberId
recordId
createdAt
```

날짜와 시간은 ISO 8601 형식을 사용한다.

```text
2026-08-04
2026-08-04T14:30:00
```

## HTTP 상태 코드

| 상황                     | 상태 코드                   |
| ------------------------ | --------------------------- |
| 일반 조회·수정 성공      | `200 OK`                    |
| 생성 성공                | `201 Created`               |
| 응답 본문 없는 삭제 성공 | `204 No Content`            |
| 잘못된 요청·규칙 위반    | `400 Bad Request`           |
| 인증 필요                | `401 Unauthorized`          |
| 권한 없음                | `403 Forbidden`             |
| 리소스 없음              | `404 Not Found`             |
| 서버 오류                | `500 Internal Server Error` |

`409 Conflict`는 사용하지 않는다. 상태 충돌은 `400`으로 표현한다.

## 요청과 응답

API마다 전용 Request/Response DTO를 사용하고 Domain 객체를 직접 노출하지 않는다.

성공 응답은 다음 형식을 사용한다.

```json
{
  "code": "SUCCESS",
  "message": "요청에 성공했습니다.",
  "data": {
    "propertyId": 1
  }
}
```

오류 응답은 다음 형식을 사용한다.

```json
{
  "code": "PROPERTY_NOT_FOUND",
  "message": "해당 매물을 찾을 수 없습니다.",
  "errors": []
}
```

- 성공 응답의 `code`는 `SUCCESS`로 고정한다.
- 오류 응답의 `code`는 `도메인_상태` 형태의 `UPPER_SNAKE_CASE`를 사용한다.
- `errors`는 입력값 검증 오류에만 사용하고 일반 비즈니스 오류에서는 빈 배열을 사용한다.
- `204 No Content`는 응답 본문을 반환하지 않는다.

## 계층 책임

- Service는 HTTP 상태, `ResponseEntity`와 Controller DTO를 알지 않는다.
- Service는 의미 있는 커스텀 예외를 발생시키고 전역 예외 처리기가 HTTP 상태와 공통 오류 응답으로 변환한다.
- Request DTO는 형식과 필수값, Service는 권한·중복·상태 전이 같은 비즈니스 규칙을 검증한다.

## Swagger 문서화

Swagger에는 다음 내용을 작성한다.

- API 목적
- 요청값과 필수 여부
- 성공 상태 코드와 응답
- 검증 오류
- 대표 비즈니스 오류
- 인증 필요 여부

공개 API 계약은 Swagger에서 관리하며, 코드 주석에는 코드만으로 알 수 없는 제약과 선택 이유만 한국어로 작성한다.

## API 변경 규칙

- URL, 필드명, 타입, 상태 코드 변경은 API 계약 변경으로 본다.
- API 변경은 구현 전에 프론트엔드와 공유한다.
- 기존 필드를 임의로 삭제하거나 의미를 변경하지 않는다.
- API 변경 PR에는 구현과 Swagger 변경을 함께 포함한다.
