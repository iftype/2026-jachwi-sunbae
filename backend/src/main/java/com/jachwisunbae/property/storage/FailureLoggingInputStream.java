package com.jachwisunbae.property.storage;

import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

// 응답 헤더를 보낸 뒤 S3에서 읽다가 실패하면 상태 코드를 바꿀 수 없어 접근 로그에는 200으로 남는다.
// 이 실패를 놓치지 않도록 S3 읽기 실패만 따로 ERROR로 남긴다. 사용자가 먼저 끊은 경우는 쓰기 쪽 실패라 여기에 잡히지 않는다.
final class FailureLoggingInputStream extends FilterInputStream {

    private static final Logger LOG = LoggerFactory.getLogger(FailureLoggingInputStream.class);

    private final String storageKey;
    private final long contentLength;
    private long bytesRead;
    private boolean failureLogged;

    FailureLoggingInputStream(final InputStream in, final String storageKey, final long contentLength) {
        super(in);
        this.storageKey = storageKey;
        this.contentLength = contentLength;
    }

    @Override
    public int read() throws IOException {
        try {
            int value = super.read();
            if (value != -1) {
                bytesRead++;
            }
            return value;
        } catch (IOException | RuntimeException exception) {
            logFailure(exception);
            throw exception;
        }
    }

    @Override
    public int read(final byte[] buffer, final int offset, final int length) throws IOException {
        try {
            int count = super.read(buffer, offset, length);
            if (count > 0) {
                bytesRead += count;
            }
            return count;
        } catch (IOException | RuntimeException exception) {
            logFailure(exception);
            throw exception;
        }
    }

    private void logFailure(final Exception exception) {
        if (failureLogged) {
            return;
        }
        failureLogged = true;
        LOG.atError()
                .addKeyValue("event_type", "photo_stream_failed")
                .addKeyValue("storage_key", storageKey)
                .addKeyValue("bytes_read", bytesRead)
                .addKeyValue("content_length", contentLength)
                .addKeyValue("error_type", exception.getClass().getName())
                .setCause(exception)
                .log("Photo stream from storage failed");
    }
}
