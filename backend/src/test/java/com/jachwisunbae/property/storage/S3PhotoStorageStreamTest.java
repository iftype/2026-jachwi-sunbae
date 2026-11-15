package com.jachwisunbae.property.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.util.Random;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.services.s3.S3Client;

// S3 응답을 바이트 배열로 모으지 않고 스트림으로 넘기는지, 길이와 내용이 그대로인지 확인한다.
class S3PhotoStorageStreamTest {

    private static final byte[] PHOTO = randomBytes(3 * 1024 * 1024);

    private HttpServer fakeS3;
    private S3Client s3Client;
    private S3PhotoStorage storage;

    @BeforeEach
    void setUp() throws IOException {
        fakeS3 = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        fakeS3.createContext("/test-photos/photos/test.jpg", exchange -> {
            exchange.getResponseHeaders().add("Content-Type", "image/jpeg");
            exchange.sendResponseHeaders(200, PHOTO.length);
            try (OutputStream body = exchange.getResponseBody()) {
                body.write(PHOTO);
            }
        });
        // 길이는 전체로 알려 놓고 1MB만 보낸 뒤 연결을 끊는다. 전송 중 S3 연결이 끊긴 상황이다.
        fakeS3.createContext("/test-photos/photos/broken.jpg", exchange -> {
            exchange.getResponseHeaders().add("Content-Type", "image/jpeg");
            exchange.sendResponseHeaders(200, PHOTO.length);
            exchange.getResponseBody().write(PHOTO, 0, 1024 * 1024);
            exchange.getResponseBody().flush();
            // 선언한 길이보다 적게 보낸 채 닫으면 JDK 서버가 예외를 던지며 연결을 끊는다. 의도한 동작이다.
            try {
                exchange.close();
            } catch (RuntimeException ignored) {
                // 연결 종료가 목적이므로 무시한다.
            }
        });
        fakeS3.start();
        PhotoStorageProperties properties = new PhotoStorageProperties("us-east-1",
                "http://127.0.0.1:" + fakeS3.getAddress().getPort(), "test-access-key", "test-secret-key",
                "test-photos", "");
        s3Client = new PhotoStorageConfig().photoS3Client(properties);
        storage = new S3PhotoStorage(s3Client, properties);
    }

    @AfterEach
    void tearDown() {
        s3Client.close();
        fakeS3.stop(0);
    }

    @Test
    @DisplayName("S3 응답 길이와 형식을 담은 스트림을 돌려주고, 끝까지 읽으면 원본과 같다")
    void opensPhotoAsStream() throws IOException {
        PhotoStream stream = storage.openStream("photos/test.jpg");

        try (InputStream content = stream.content()) {
            assertThat(stream.contentLength()).isEqualTo(PHOTO.length);
            assertThat(stream.contentType()).isEqualTo("image/jpeg");
            assertThat(content.readAllBytes()).isEqualTo(PHOTO);
        }
    }

    @Test
    @DisplayName("전송 중 S3 연결이 끊기면 읽기가 실패하고 photo_stream_failed를 ERROR로 남긴다")
    void logsWhenStreamBreaksMidway() throws IOException {
        Logger logger = (Logger) LoggerFactory.getLogger(FailureLoggingInputStream.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        try {
            PhotoStream stream = storage.openStream("photos/broken.jpg");

            try (InputStream content = stream.content()) {
                assertThatThrownBy(content::readAllBytes).isInstanceOfAny(IOException.class, RuntimeException.class);
            }

            assertThat(appender.list).singleElement().satisfies(event -> {
                assertThat(event.getLevel().toString()).isEqualTo("ERROR");
                assertThat(event.getKeyValuePairs()).anySatisfy(pair -> {
                    assertThat(pair.key).isEqualTo("event_type");
                    assertThat(pair.value).isEqualTo("photo_stream_failed");
                });
            });
        } finally {
            logger.detachAppender(appender);
        }
    }

    private static byte[] randomBytes(final int size) {
        byte[] bytes = new byte[size];
        new Random(42).nextBytes(bytes);
        return bytes;
    }
}
