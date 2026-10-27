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
    ACCESS_TOKEN_INVALID("ACCESS 인증 정보를 확인할 수 없습니다."),
    REFRESH_TOKEN_INVALID("REFRESH 인증 정보를 확인할 수 없습니다."),
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

    // 거리 메모
    STREET_MEMO_CONTENT_INVALID("거리 메모 내용을 확인해 주세요."),
    STREET_MEMO_LOCATION_INVALID("거리 메모 위치를 확인해 주세요."),
    STREET_MEMO_QUERY_INVALID("거리 메모 조회 영역을 확인해 주세요."),
    STREET_MEMO_PREFERENCE_INVALID("거리 메모의 좋아요·싫어요를 선택해 주세요."),
    STREET_MEMO_NOT_FOUND("거리 메모를 찾을 수 없습니다."),

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

    // 편의점 행사상품
    PROMOTION_PROVIDER_UNAVAILABLE("행사상품 정보를 불러오지 못했습니다."),
    PROMOTION_RESPONSE_INVALID("행사상품 정보를 불러오지 못했습니다."),

    // 날씨
    WEATHER_PROVIDER_UNAVAILABLE("날씨 정보를 불러오지 못했습니다."),
    WEATHER_RESPONSE_INVALID("날씨 정보를 불러오지 못했습니다."),
    WEATHER_COORDINATE_INVALID("위도와 경도를 확인해 주세요."),
    WEATHER_LOCATION_UNSUPPORTED("날씨를 제공하지 않는 위치입니다."),

    WEATHER_DEVICE_CONFLICT("기기 등록 상태를 확인하고 다시 시도해 주세요."),
    WEATHER_NOTIFICATION_NOT_FOUND("알림을 찾을 수 없습니다."),

    // 대중교통
    TRANSIT_FEED_READ_FAILURE("대중교통 데이터를 불러오지 못했습니다."),
    ADMIN_DONG_READ_FAILURE("행정동 경계 데이터를 불러오지 못했습니다."),
    TRANSIT_NETWORK_UNAVAILABLE("대중교통 정보를 준비하고 있습니다. 잠시 후 다시 시도해 주세요."),
    COMMUTE_DESTINATION_UNREACHABLE("목적지에서 걸어서 10분 안에 이용할 수 있는 정류장·역이 없습니다."),
    TRANSIT_STOP_NOT_FOUND("정류장을 찾을 수 없습니다."),
    COMMUTE_ROUTE_NOT_FOUND("최대 통근 시간 안에 목적지까지 가는 경로가 없습니다."),
    RENTAL_QUERY_INVALID("지역 코드와 페이지 정보를 확인해 주세요.");

    private final String publicMessage;

    ErrorCode(String publicMessage) {
        this.publicMessage = publicMessage;
    }

    public String publicMessage() {
        return publicMessage;
    }
}
