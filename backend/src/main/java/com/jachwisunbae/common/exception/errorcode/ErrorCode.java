package com.jachwisunbae.common.exception.errorcode;

// 클라이언트가 오류를 구분하는 안정적인 식별자이자 API 계약이다.
// publicMessage는 응답에 그대로 나가므로 내부 정보를 넣지 않는다. HTTP 상태는 예외 타입이 정한다.
public enum ErrorCode {

    // 요청 및 서버 공통
    INVALID_REQUEST("요청 값을 확인해 주세요."),
    METHOD_NOT_ALLOWED("지원하지 않는 요청 메서드입니다."),
    UNSUPPORTED_MEDIA_TYPE("지원하지 않는 미디어 타입입니다."),
    RESOURCE_NOT_FOUND("요청한 리소스를 찾을 수 없습니다."),
    INTERNAL_SERVER_ERROR("서버 내부 오류가 발생했습니다."),

    // 회원 및 인증
    NICKNAME_INVALID("닉네임을 확인해 주세요."),
    NICKNAME_PASSWORD_INVALID("비밀번호를 확인해 주세요."),
    NICKNAME_AUTHENTICATION_FAILED("닉네임 또는 비밀번호를 확인해 주세요."),
    ACCESS_TOKEN_INVALID("인증 정보를 확인할 수 없습니다."),
    MEMBER_NOT_FOUND("회원을 찾을 수 없습니다."),

    // 체크리스트
    INVALID_SYSTEM_CHECK_ITEM("체크 항목을 확인해 주세요."),
    USER_CHECKLIST_NAME_INVALID("체크리스트 이름을 확인해 주세요."),
    CHECKLIST_NOT_FOUND("체크리스트를 찾을 수 없습니다."),
    CHECKLIST_ITEMS_INVALID("체크리스트 항목을 확인해 주세요."),
    CHECKLIST_INACTIVE_ITEM_NOT_ALLOWED("사용할 수 없는 체크 항목이 포함되어 있습니다."),
    DUPLICATE_CHECK_ITEM("이미 추가한 체크 항목입니다."),
    CHECKLIST_ITEM_COUNT_OUT_OF_RANGE("체크 항목 개수를 확인해 주세요."),

    // 매물
    PROPERTY_INPUT_INVALID("매물 정보를 확인해 주세요."),
    PROPERTY_LOCATION_INVALID("매물 위치를 확인해 주세요."),
    PROPERTY_NOT_FOUND("매물을 찾을 수 없습니다."),
    PROPERTY_LIMIT_EXCEEDED("등록할 수 있는 매물 개수를 초과했습니다."),
    PROPERTY_MEMO_INVALID("메모를 확인해 주세요."),
    PROPERTY_CHECKLIST_STAGE_MISMATCH("매물 체크리스트의 단계가 맞지 않습니다."),
    PROPERTY_CHECKLIST_NOT_FOUND("매물 체크리스트를 찾을 수 없습니다."),
    PROPERTY_CHECKLIST_ITEM_NOT_FOUND("매물 체크 항목을 찾을 수 없습니다."),
    PROPERTY_CHECK_RESULT_INVALID("체크 결과를 확인해 주세요."),
    PROPERTY_COMPARISON_EXPORT_FAILED("매물 비교 자료를 만들지 못했습니다."),

    // 사진
    PHOTO_NOT_FOUND("사진을 찾을 수 없습니다."),
    PHOTO_LIMIT_EXCEEDED("등록할 수 있는 사진 개수를 초과했습니다."),
    PHOTO_CONTENT_TYPE_UNSUPPORTED("지원하지 않는 사진 형식입니다."),
    PHOTO_FILE_SIZE_INVALID("사진 파일 크기를 확인해 주세요."),
    PHOTO_FILE_TOO_LARGE("파일 크기 제한을 초과했습니다."),
    PHOTO_FILE_READ_FAILURE("사진 파일을 읽을 수 없습니다."),
    PHOTO_STORAGE_FAILURE("사진을 저장하지 못했습니다."),

    // 지도
    MAP_QUERY_INVALID("지도 요청 값을 확인해 주세요."),
    MAP_ADDRESS_NOT_FOUND("해당 위치의 주소를 찾을 수 없습니다."),
    MAP_PROVIDER_UNAVAILABLE("지도 정보를 불러오지 못했습니다."),

    // 대중교통
    TRANSIT_FEED_READ_FAILURE("대중교통 데이터를 불러오지 못했습니다.");

    private final String publicMessage;

    ErrorCode(String publicMessage) {
        this.publicMessage = publicMessage;
    }

    public String publicMessage() {
        return publicMessage;
    }
}
