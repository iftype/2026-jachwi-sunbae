package com.jachwisunbae.property.ai;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;

class BedrockConfigTest {

    @Test
    @DisplayName("설정한 리전으로 Bedrock 클라이언트를 만들고 모델 ID를 읽는다")
    void createsClientWithConfiguredRegion() {
        new ApplicationContextRunner()
                .withUserConfiguration(BedrockConfig.class, PropertiesConfig.class)
                .withPropertyValues(
                        "property.ai.bedrock.region=ap-northeast-2",
                        "property.ai.bedrock.model-id=global.anthropic.claude-sonnet-5-5")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    var client = context.getBean(BedrockRuntimeClient.class);
                    assertThat(client.serviceClientConfiguration().region()).isEqualTo(Region.AP_NORTHEAST_2);
                    assertThat(context.getBean(BedrockProperties.class).modelId())
                            .isEqualTo("global.anthropic.claude-sonnet-5-5");
                });
    }

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(BedrockProperties.class)
    static class PropertiesConfig {
    }
}
