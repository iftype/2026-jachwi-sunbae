package com.jachwisunbae.common.observability;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import javax.xml.parsers.DocumentBuilderFactory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.DefaultBootstrapContext;
import org.springframework.boot.actuate.autoconfigure.endpoint.web.WebEndpointProperties;
import org.springframework.boot.actuate.autoconfigure.metrics.MetricsProperties;
import org.springframework.boot.actuate.autoconfigure.web.server.ManagementServerProperties;
import org.springframework.boot.context.config.ConfigDataEnvironmentPostProcessor;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.env.Profiles;
import org.springframework.core.io.DefaultResourceLoader;
import org.w3c.dom.Element;

// 애플리케이션을 띄우지 않고 실제 application*.yml을 프로필 순서대로 읽어 Actuator 설정만 확인한다.
class ActuatorProfileConfigurationTest {

    @ParameterizedTest
    @ValueSource(strings = {"dev", "prod"})
    @DisplayName("dev·prod 프로필은 기존 API 포트와 Actuator 설정을 유지한다")
    void serverProfilesExposePrometheusOnApplicationPort(final String profile) {
        Binder binder = binder(profile);

        ManagementServerProperties server = binder.bindOrCreate("management.server", ManagementServerProperties.class);
        WebEndpointProperties web = binder.bindOrCreate("management.endpoints.web", WebEndpointProperties.class);
        MetricsProperties metrics = binder.bindOrCreate("management.metrics", MetricsProperties.class);

        assertThat(binder.bind("server.port", Integer.class).get()).isEqualTo(80);
        assertThat(server.getPort()).isNull();
        assertThat(server.getAddress()).isNull();
        assertThat(web.getExposure().getInclude()).containsExactlyInAnyOrder("health", "info", "prometheus");
        assertThat(metrics.getDistribution().getPercentilesHistogram()).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"local", "test", "dev", "prod"})
    @DisplayName("dev 프로필 분리 이후에도 서버는 JSON 파일 로그를, 로컬·테스트는 콘솔 로그만 사용한다")
    void profilesSelectTheExistingLogDestinations(final String profile) throws Exception {
        StandardEnvironment environment = new StandardEnvironment();
        environment.setActiveProfiles(profile);
        List<String> appenders = new ArrayList<>();
        try (var input = getClass().getResourceAsStream("/logback-spring.xml")) {
            var document = DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(input);
            var configurations = document.getElementsByTagName("springProfile");
            for (int i = 0; i < configurations.getLength(); i++) {
                Element configuration = (Element) configurations.item(i);
                if (environment.acceptsProfiles(Profiles.of(configuration.getAttribute("name")))) {
                    var references = configuration.getElementsByTagName("appender-ref");
                    for (int j = 0; j < references.getLength(); j++) {
                        appenders.add(((Element) references.item(j)).getAttribute("ref"));
                    }
                }
            }
        }
        assertThat(appenders).containsExactlyElementsOf(List.of("dev", "prod").contains(profile)
                ? List.of("CONSOLE", "JSON_FILE") : List.of("CONSOLE"));
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
