package com.jachwisunbae.common.config;

import javax.sql.DataSource;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.FileSystemResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;

@Configuration(proxyBeanMethods = false)
@Profile("local")
public class LocalDatabaseSampleConfig {

    @Bean
    public FlywayMigrationStrategy localSampleMigrationStrategy() {
        return flyway -> {
            flyway.migrate();
            DataSource dataSource = flyway.getConfiguration().getDataSource();
            loadIfEmpty(dataSource, "bus_stops", "003-bus-stops-sample.sql");
            loadIfEmpty(dataSource, "good_price_stores", "004-good-price-stores-sample.sql");
            loadIfEmpty(dataSource, "cctvs", "005-cctvs-sample.sql");
        };
    }

    private void loadIfEmpty(DataSource dataSource, String table, String fileName) {
        JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
        if (!jdbcTemplate.queryForList("SELECT 1 FROM " + table + " LIMIT 1", Integer.class).isEmpty()) {
            return;
        }
        new ResourceDatabasePopulator(
                new FileSystemResource("docker/mysql/init/" + fileName)).execute(dataSource);
    }
}
