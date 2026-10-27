package com.jachwisunbae.streetmemo.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.spy;

import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.client.ResourceNotFoundException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.DataInconsistencyException;
import com.jachwisunbae.member.repository.JdbcMemberRepository;
import com.jachwisunbae.member.service.MemberService;
import com.jachwisunbae.streetmemo.domain.StreetMemoPreference;
import com.jachwisunbae.streetmemo.repository.JdbcStreetMemoRepository;
import com.jachwisunbae.streetmemo.service.dto.result.StreetMemoResult;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class StreetMemoServiceIntegrationTest {

    @Container
    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.10");

    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-26T12:00:00Z"), ZoneOffset.UTC);
    private static final LocalDateTime NOW = LocalDateTime.now(CLOCK);
    private static final BigDecimal MIN_LATITUDE = new BigDecimal("37.39");
    private static final BigDecimal MAX_LATITUDE = new BigDecimal("37.40");
    private static final BigDecimal MIN_LONGITUDE = new BigDecimal("127.11");
    private static final BigDecimal MAX_LONGITUDE = new BigDecimal("127.12");

    private static AnnotationConfigApplicationContext context;
    private static DataSource dataSource;
    private static JdbcTemplate jdbcTemplate;
    private static JdbcStreetMemoRepository repository;
    private static StreetMemoService service;

    @BeforeAll
    static void setUpContext() {
        dataSource = new DriverManagerDataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword());
        Flyway.configure().dataSource(dataSource).load().migrate();
        context = new AnnotationConfigApplicationContext();
        context.registerBean(DataSource.class, () -> dataSource);
        context.registerBean(Clock.class, () -> CLOCK);
        context.register(TestConfig.class);
        context.refresh();
        jdbcTemplate = context.getBean(JdbcTemplate.class);
        repository = context.getBean(JdbcStreetMemoRepository.class);
        service = context.getBean(StreetMemoService.class);
    }

    @AfterAll
    static void closeContext() {
        if (context != null) {
            context.close();
        }
    }

    @BeforeEach
    void clearData() {
        reset(repository);
        jdbcTemplate.update("DELETE FROM street_memos");
        jdbcTemplate.update("DELETE FROM members");
    }

    @Test
    @DisplayName("생성 응답의 좌표는 DB에 저장한 소수점 7자리 정밀도로 재조회 결과와 일치한다")
    void returnsStoredCoordinatePrecision() {
        long member = insertMember();

        StreetMemoResult result = create(member, "37.39480004", "127.11120004", StreetMemoPreference.LIKE);

        assertThat(result.latitude()).isEqualTo(new BigDecimal("37.3948000"));
        assertThat(result.longitude()).isEqualTo(new BigDecimal("127.1112000"));
        assertThat(service.findAllWithin(member, MIN_LATITUDE, MAX_LATITUDE, MIN_LONGITUDE, MAX_LONGITUDE)).containsExactly(result);
    }

    @Test
    @DisplayName("실제 INSERT 이후 저장소에서 실패해도 작성 트랜잭션을 롤백한다")
    void rollsBackInsertWhenSaveFails() {
        long member = insertMember();
        doAnswer(invocation -> {
            invocation.callRealMethod();
            throw new IllegalStateException("저장 직후 실패 재현");
        }).when(repository).save(any());

        assertThatThrownBy(() -> create(member, "37.3948000", "127.1112000", StreetMemoPreference.LIKE))
                .isInstanceOf(IllegalStateException.class).hasMessage("저장 직후 실패 재현");
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM street_memos", Integer.class)).isZero();
    }

    @Test
    @DisplayName("동시에 같은 메모를 삭제해도 한 요청만 성공하고 행은 유지된다")
    void deletesOnlyOnceConcurrently() throws Exception {
        long member = insertMember();
        StreetMemoResult result = create(member, "37.3948000", "127.1112000", StreetMemoPreference.LIKE);
        CountDownLatch start = new CountDownLatch(1);

        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<Boolean> first = executor.submit(() -> deleteAfterStart(start, member, result.id()));
            Future<Boolean> second = executor.submit(() -> deleteAfterStart(start, member, result.id()));
            start.countDown();

            assertThat(List.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(true, false);
        }
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM street_memos", Integer.class)).isOne();
        assertThat(service.findAllWithin(member, MIN_LATITUDE, MAX_LATITUDE, MIN_LONGITUDE, MAX_LONGITUDE)).isEmpty();
    }

    @Test
    @DisplayName("저장된 선호 코드가 손상된 메모는 입력 검증 예외를 서버 데이터 오류로 변환한다")
    void reportsInvalidStoredPreferenceAsServerError() {
        long member = insertMember();
        create(member, "37.3948000", "127.1112000", StreetMemoPreference.LIKE);
        jdbcTemplate.execute("ALTER TABLE street_memos ALTER CHECK chk_street_memos_preference NOT ENFORCED");
        try {
            jdbcTemplate.update("UPDATE street_memos SET preference = 'NEUTRAL'");

            assertThatThrownBy(() -> service.findAllWithin(member, MIN_LATITUDE, MAX_LATITUDE, MIN_LONGITUDE, MAX_LONGITUDE))
                    .isInstanceOfSatisfying(DataInconsistencyException.class, exception -> {
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.INTERNAL_SERVER_ERROR);
                        assertThat(exception.getCause()).isInstanceOf(InvalidInputException.class);
                    });
        } finally {
            jdbcTemplate.update("UPDATE street_memos SET preference = 'LIKE'");
            jdbcTemplate.execute("ALTER TABLE street_memos ALTER CHECK chk_street_memos_preference ENFORCED");
        }
    }

    private static boolean deleteAfterStart(CountDownLatch start, long member, long memoId) throws InterruptedException {
        start.await();
        try {
            service.delete(member, memoId);
            return true;
        } catch (ResourceNotFoundException exception) {
            return false;
        }
    }

    private static StreetMemoResult create(long member, String latitude, String longitude, StreetMemoPreference preference) {
        return service.create(member, new BigDecimal(latitude), new BigDecimal(longitude),
                "  동네 메모 🏠\n원문 유지  ", preference);
    }

    private static long insertMember() {
        jdbcTemplate.update("INSERT INTO members (created_at, updated_at) VALUES (?, ?)", NOW, NOW);
        return jdbcTemplate.queryForObject("SELECT MAX(id) FROM members", Long.class);
    }

    @TestConfiguration(proxyBeanMethods = false)
    @EnableTransactionManagement
    @Import({StreetMemoService.class, MemberService.class, JdbcMemberRepository.class})
    static class TestConfig {

        @Bean
        JdbcTemplate jdbcTemplate(DataSource dataSource) {
            return new JdbcTemplate(dataSource);
        }

        @Bean
        PlatformTransactionManager transactionManager(DataSource dataSource) {
            return new DataSourceTransactionManager(dataSource);
        }

        @Bean
        JdbcStreetMemoRepository streetMemoRepository(JdbcTemplate jdbcTemplate) {
            return spy(new JdbcStreetMemoRepository(jdbcTemplate));
        }
    }
}
