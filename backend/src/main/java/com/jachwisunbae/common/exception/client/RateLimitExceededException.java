package com.jachwisunbae.common.exception.client;

import com.jachwisunbae.common.exception.errorcode.ErrorCode;

// 정해진 기간 안에 허용된 호출 횟수를 넘었다. 기간이 지나면 같은 요청이 성공한다. (429)
public class RateLimitExceededException extends ClientException {

    public RateLimitExceededException(ErrorCode errorCode, String debugMessage) {
        super(errorCode, debugMessage);
    }
}
