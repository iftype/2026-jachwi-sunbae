package com.jachwisunbae.common.observability;

import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.WriteListener;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletResponseWrapper;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.Charset;

// 응답을 그대로 흘려보내면서, 실패 로그에 남길 앞부분만 복사해 둔다.
// 본문 전체를 메모리에 모았다가 보내면 사진처럼 큰 응답이 요청마다 힙에 통째로 쌓인다.
final class BodyCapturingResponseWrapper extends HttpServletResponseWrapper {

    private final int captureLimit;
    private final ByteArrayOutputStream captured = new ByteArrayOutputStream();
    private long totalBytes;
    private ServletOutputStream outputStream;
    private PrintWriter writer;

    BodyCapturingResponseWrapper(final HttpServletResponse response, final int captureLimit) {
        super(response);
        this.captureLimit = captureLimit;
    }

    @Override
    public ServletOutputStream getOutputStream() throws IOException {
        if (writer != null) {
            throw new IllegalStateException("getWriter() has already been called on this response.");
        }
        if (outputStream == null) {
            outputStream = new CapturingOutputStream(super.getOutputStream());
        }
        return outputStream;
    }

    @Override
    public PrintWriter getWriter() throws IOException {
        if (outputStream != null) {
            throw new IllegalStateException("getOutputStream() has already been called on this response.");
        }
        if (writer == null) {
            Charset charset = Charset.forName(getCharacterEncoding());
            writer = new PrintWriter(new OutputStreamWriter(new CapturingOutputStream(super.getOutputStream()), charset));
        }
        return writer;
    }

    @Override
    public void flushBuffer() throws IOException {
        flushWriter();
        super.flushBuffer();
    }

    @Override
    public void resetBuffer() {
        super.resetBuffer();
        clearCaptured();
    }

    @Override
    public void reset() {
        super.reset();
        clearCaptured();
    }

    // PrintWriter는 자체 버퍼가 있어 내보내지 않으면 응답에도 로그에도 본문이 남지 않는다.
    void flushWriter() {
        if (writer != null) {
            writer.flush();
        }
    }

    byte[] capturedBody() {
        return captured.toByteArray();
    }

    boolean isTruncated() {
        return totalBytes > captureLimit;
    }

    long totalBytes() {
        return totalBytes;
    }

    private void capture(final byte[] buffer, final int offset, final int length) {
        int room = captureLimit - captured.size();
        if (room > 0) {
            captured.write(buffer, offset, Math.min(room, length));
        }
        totalBytes += length;
    }

    private void clearCaptured() {
        captured.reset();
        totalBytes = 0;
    }

    private final class CapturingOutputStream extends ServletOutputStream {

        private final ServletOutputStream delegate;

        private CapturingOutputStream(final ServletOutputStream delegate) {
            this.delegate = delegate;
        }

        @Override
        public void write(final int value) throws IOException {
            delegate.write(value);
            capture(new byte[] {(byte) value}, 0, 1);
        }

        @Override
        public void write(final byte[] buffer, final int offset, final int length) throws IOException {
            delegate.write(buffer, offset, length);
            capture(buffer, offset, length);
        }

        @Override
        public void flush() throws IOException {
            delegate.flush();
        }

        @Override
        public void close() throws IOException {
            delegate.close();
        }

        @Override
        public boolean isReady() {
            return delegate.isReady();
        }

        @Override
        public void setWriteListener(final WriteListener listener) {
            delegate.setWriteListener(listener);
        }
    }
}
