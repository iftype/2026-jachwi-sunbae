package com.jachwisunbae.common.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class LocalDatabaseSampleConfigTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(LocalDatabaseSampleConfig.class);

    @Test
    void registersSampleLoadingOnlyForLocalProfile() {
        contextRunner.withInitializer(context -> context.getEnvironment().setActiveProfiles("local"))
                .run(context -> assertThat(context).hasSingleBean(FlywayMigrationStrategy.class));
    }

    @ParameterizedTest
    @ValueSource(strings = {"prod", "test", "perf"})
    void doesNotLoadLocalSamplesForOtherProfiles(String profile) {
        contextRunner.withInitializer(context -> context.getEnvironment().setActiveProfiles(profile))
                .run(context -> assertThat(context).doesNotHaveBean(FlywayMigrationStrategy.class));
    }
}
