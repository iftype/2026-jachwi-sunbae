package com.jachwisunbae.common.exception.server;

import com.jachwisunbae.common.exception.errorcode.ErrorCode;

// 기능에 필요한 데이터나 자원이 아직 준비되지 않아 지금은 처리할 수 없다. 잠시 후 다시 시도할 수 있다. (503)
public class ServiceUnavailableException extends ServerException {

    public ServiceUnavailableException(ErrorCode errorCode, String debugMessage) {
        super(errorCode, debugMessage);
    }
}
