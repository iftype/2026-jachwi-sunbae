package com.jachwisunbae.promotion.support;

import com.jachwisunbae.promotion.repository.JdbcPromotionProductRepository;
import javax.sql.DataSource;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;

// @Transactional 프록시가 실제로 적용된 Repository를 MySQL 컨테이너에 연결한다.
@TestConfiguration(proxyBeanMethods = false)
@EnableTransactionManagement
@Import(JdbcPromotionProductRepository.class)
public class PromotionDatabaseTestConfiguration {

    @Bean
    JdbcTemplate jdbcTemplate(final DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }

    @Bean
    PlatformTransactionManager transactionManager(final DataSource dataSource) {
        return new DataSourceTransactionManager(dataSource);
    }
}
