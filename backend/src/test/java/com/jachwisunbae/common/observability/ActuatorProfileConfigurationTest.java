package com.jachwisunbae.common.observability;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.InetAddress;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultBootstrapContext;
import org.springframework.boot.actuate.autoconfigure.endpoint.web.WebEndpointProperties;
import org.springframework.boot.actuate.autoconfigure.metrics.MetricsProperties;
import org.springframework.boot.actuate.autoconfigure.web.server.ManagementServerProperties;
import org.springframework.boot.context.config.ConfigDataEnvironmentPostProcessor;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.DefaultResourceLoader;

// 애플리케이션을 띄우지 않고 실제 application*.yml을 프로필 순서대로 읽어 Actuator 설정만 확인한다.
class ActuatorProfileConfigurationTest {

    @Test
    @DisplayName("prod 프로필은 API 포트에서 health와 info만 노출한다")
    void prodExposesOnlyHealthAndInfoOnApplicationPort() {
        Binder binder = binder("prod");

        ManagementServerProperties server = binder.bindOrCreate("management.server", ManagementServerProperties.class);
        WebEndpointProperties web = binder.bindOrCreate("management.endpoints.web", WebEndpointProperties.class);
        MetricsProperties metrics = binder.bindOrCreate("management.metrics", MetricsProperties.class);

        assertThat(server.getPort()).isNull();
        assertThat(server.getAddress()).isNull();
        assertThat(web.getExposure().getInclude()).containsExactlyInAnyOrder("health", "info");
        assertThat(metrics.getDistribution().getPercentilesHistogram()).isEmpty();
    }

    @Test
    @DisplayName("prod,perf 프로필은 API 포트 80을 유지하고 127.0.0.1:9091에서 prometheus까지 노출한다")
    void perfExposesPrometheusOnLocalManagementPort() throws Exception {
        Binder binder = binder("prod", "perf");

        ManagementServerProperties server = binder.bindOrCreate("management.server", ManagementServerProperties.class);
        WebEndpointProperties web = binder.bindOrCreate("management.endpoints.web", WebEndpointProperties.class);
        MetricsProperties metrics = binder.bindOrCreate("management.metrics", MetricsProperties.class);

        assertThat(binder.bind("server.port", Integer.class).get()).isEqualTo(80);
        assertThat(server.getPort()).isEqualTo(9091);
        assertThat(server.getAddress()).isEqualTo(InetAddress.getByName("127.0.0.1"));
        assertThat(web.getExposure().getInclude()).containsExactlyInAnyOrder("health", "info", "prometheus");
        assertThat(metrics.getDistribution().getPercentilesHistogram()).containsEntry("http.server.requests", true);
    }

    private static Binder binder(String... profiles) {
        StandardEnvironment environment = new StandardEnvironment();
        // 로컬 셸의 환경변수가 설정으로 섞이지 않게 제외한다.
        environment.getPropertySources().remove(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME);
        environment.setActiveProfiles(profiles);
        ConfigDataEnvironmentPostProcessor.applyTo(environment, new DefaultResourceLoader(),
                new DefaultBootstrapContext());
        return Binder.get(environment);
    }
}
