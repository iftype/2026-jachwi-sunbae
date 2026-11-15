package com.jachwisunbae.property.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import com.jachwisunbae.property.storage.PhotoContent;
import com.jachwisunbae.property.storage.PhotoStorage;
import com.jachwisunbae.property.storage.PhotoStream;
import com.zaxxer.hikari.HikariDataSource;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.sql.SQLException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicIntegerArray;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

// 사진 조회는 S3에서 바이트를 받는 동안 DB 커넥션을 잡지 않아야 한다.
// 커넥션을 잡은 채 기다리면 목록 화면의 사진 동시 요청만으로 커넥션 풀이 차서 다른 API가 대기한다.
@Testcontainers
@SpringBootTest
@ActiveProfiles("test")
class PropertyPhotoServiceConnectionTest {

    @Container
    @ServiceConnection
    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.10");

    @Autowired
    private PropertyPhotoService service;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private DataSource dataSource;

    @MockitoBean
    private PhotoStorage photoStorage;

    @BeforeEach
    void clear() {
        jdbc.update("DELETE FROM property_photos");
        jdbc.update("DELETE FROM properties");
        jdbc.update("DELETE FROM refresh_tokens");
        jdbc.update("DELETE FROM members");
    }

    @Test
    @DisplayName("사진 바이트를 내려받는 동안 트랜잭션과 DB 커넥션을 잡지 않는다")
    void downloadsPhotoWithoutHoldingConnection() throws SQLException {
        jdbc.update("INSERT INTO members (id, created_at, updated_at) VALUES (1, NOW(6), NOW(6))");
        jdbc.update("INSERT INTO properties (id, member_id, name, created_at) VALUES (10, 1, '집', NOW(6))");
        jdbc.update("""
                INSERT INTO property_photos (id, property_id, member_id, storage_key, content_type, size_bytes, created_at)
                VALUES (100, 10, 1, 'photos/test.jpg', 'image/jpeg', 3, NOW(6))
                """);
        AtomicBoolean transactionActive = new AtomicBoolean(true);
        AtomicInteger activeConnections = new AtomicInteger(-1);
        HikariDataSource pool = dataSource.unwrap(HikariDataSource.class);
        when(photoStorage.download(anyString())).thenAnswer(invocation -> {
            transactionActive.set(TransactionSynchronizationManager.isActualTransactionActive());
            activeConnections.set(pool.getHikariPoolMXBean().getActiveConnections());
            return new byte[] {1, 2, 3};
        });

        PhotoContent content = service.findContent(1L, 10L, 100L);

        assertThat(content.bytes()).containsExactly(1, 2, 3);
        assertThat(transactionActive).isFalse();
        assertThat(activeConnections).hasValue(0);
    }
    @Test
    @DisplayName("사진 스트림을 여는 동안과 응답으로 흘려보내는 동안 DB 커넥션을 잡지 않는다")
    void streamsPhotoWithoutHoldingConnection() throws SQLException, IOException {
        insertPhoto();
        HikariDataSource pool = dataSource.unwrap(HikariDataSource.class);
        AtomicInteger connectionsWhileOpening = new AtomicInteger(-1);
        // 컨트롤러가 응답을 쓰는 동안 읽히는 스트림. 읽을 때마다 활성 커넥션 수의 최댓값을 기록한다.
        AtomicIntegerArray maxConnectionsWhileReading = new AtomicIntegerArray(1);
        InputStream body = new ByteArrayInputStream(new byte[] {1, 2, 3}) {
            @Override
            public synchronized int read(final byte[] buffer, final int offset, final int length) {
                maxConnectionsWhileReading.accumulateAndGet(0,
                        pool.getHikariPoolMXBean().getActiveConnections(), Math::max);
                return super.read(buffer, offset, length);
            }
        };
        when(photoStorage.openStream(anyString())).thenAnswer(invocation -> {
            connectionsWhileOpening.set(pool.getHikariPoolMXBean().getActiveConnections());
            return new PhotoStream(body, 3, "application/octet-stream");
        });

        PhotoStream stream = service.openContent(1L, 10L, 100L);
        // 응답을 쓰는 것처럼 버퍼 단위로 읽는다. ByteArrayInputStream.readAllBytes는 read(byte[], int, int)를 거치지 않는다.
        byte[] buffer = new byte[8];
        int read = stream.content().read(buffer, 0, buffer.length);

        assertThat(read).isEqualTo(3);
        assertThat(buffer).startsWith(1, 2, 3);
        assertThat(stream.contentLength()).isEqualTo(3);
        assertThat(stream.contentType()).isEqualTo("image/jpeg");
        assertThat(connectionsWhileOpening).hasValue(0);
        assertThat(maxConnectionsWhileReading.get(0)).isZero();
    }

    private void insertPhoto() {
        jdbc.update("INSERT INTO members (id, created_at, updated_at) VALUES (1, NOW(6), NOW(6))");
        jdbc.update("INSERT INTO properties (id, member_id, name, created_at) VALUES (10, 1, '집', NOW(6))");
        jdbc.update("""
                INSERT INTO property_photos (id, property_id, member_id, storage_key, content_type, size_bytes, created_at)
                VALUES (100, 10, 1, 'photos/test.jpg', 'image/jpeg', 3, NOW(6))
                """);
    }
}
