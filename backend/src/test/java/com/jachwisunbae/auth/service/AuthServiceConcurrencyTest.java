package com.jachwisunbae.auth.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.jachwisunbae.auth.service.dto.command.NicknameLoginCommand;
import com.jachwisunbae.auth.service.dto.result.LoginResult;
import com.jachwisunbae.auth.token.JwtTokenProvider;
import com.jachwisunbae.member.repository.JdbcMemberRepository;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.crypto.password.Pbkdf2PasswordEncoder;
import org.springframework.security.crypto.password.Pbkdf2PasswordEncoder.SecretKeyFactoryAlgorithm;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

// synchronized 없이 DB 유니크 제약만으로 동시 가입이 처리되는지 실제 MySQL로 확인한다.
@Testcontainers
class AuthServiceConcurrencyTest {

    @Container
    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.10");
    private static final int REQUEST_COUNT = 8;

    private static JdbcTemplate jdbcTemplate;
    private static AuthService authService;

    @BeforeAll
    static void setUp() {
        DataSource dataSource = new DriverManagerDataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(),
                MYSQL.getPassword());
        Flyway.configure().dataSource(dataSource).load().migrate();
        jdbcTemplate = new JdbcTemplate(dataSource);
        Clock clock = Clock.systemUTC();
        authService = new AuthService(new JdbcMemberRepository(jdbcTemplate),
                new Pbkdf2PasswordEncoder("", 16, 1_000, SecretKeyFactoryAlgorithm.PBKDF2WithHmacSHA256),
                new JwtTokenProvider("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=", "jachwi-sunbae",
                        "jachwi-sunbae-api", 43_200, clock),
                clock, 43_200);
    }

    @Test
    @DisplayName("같은 새 닉네임으로 동시에 시작해도 회원은 하나만 만들어지고 모두 그 회원으로 로그인한다")
    void createsOneMemberForConcurrentLogins() throws Exception {
        List<LoginResult> responses = loginConcurrently("동시닉네임", null);

        assertThat(responses).extracting(response -> response.memberId()).containsOnly(
                responses.get(0).memberId());
        assertThat(responses).filteredOn(LoginResult::newMember).hasSize(1);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM members WHERE nickname = '동시닉네임'",
                Integer.class)).isOne();
    }

    @Test
    @DisplayName("같은 새 닉네임과 같은 비밀번호로 동시에 시작해도 보호 회원은 하나만 만들어지고 모두 그 회원으로 로그인한다")
    void createsOneProtectedMemberForConcurrentLogins() throws Exception {
        List<LoginResult> responses = loginConcurrently("동시보호닉네임", "1234");

        assertThat(responses).extracting(LoginResult::memberId).containsOnly(responses.get(0).memberId());
        assertThat(responses).allMatch(LoginResult::passwordProtected);
        assertThat(responses).filteredOn(LoginResult::newMember).hasSize(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM members WHERE nickname = '동시보호닉네임' AND password_protected = TRUE",
                Integer.class)).isOne();
    }

    private List<LoginResult> loginConcurrently(String nickname, String password) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(REQUEST_COUNT);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<LoginResult>> futures = new ArrayList<>();
        for (int i = 0; i < REQUEST_COUNT; i++) {
            Callable<LoginResult> task = () -> {
                start.await();
                return authService.loginNickname(new NicknameLoginCommand(nickname, password));
            };
            futures.add(executor.submit(task));
        }
        start.countDown();

        List<LoginResult> responses = new ArrayList<>();
        for (Future<LoginResult> future : futures) {
            responses.add(future.get());
        }
        executor.shutdown();
        return responses;
    }
}
