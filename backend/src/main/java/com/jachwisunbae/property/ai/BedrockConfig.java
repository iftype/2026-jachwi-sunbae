package com.jachwisunbae.property.ai;

import java.time.Duration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;
import software.amazon.awssdk.http.apache.ApacheHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;

@Configuration
public class BedrockConfig {

    // 이미지 분석은 응답을 다 만든 뒤에 돌려주므로 SDK 기본 소켓 타임아웃(30초)보다 길게 기다린다.
    private static final Duration RESPONSE_TIMEOUT = Duration.ofSeconds(60);

    @Bean
    public BedrockRuntimeClient bedrockRuntimeClient(final BedrockProperties properties) {
        return BedrockRuntimeClient.builder()
                .region(Region.of(properties.region()))
                .credentialsProvider(DefaultCredentialsProvider.builder().build())
                .httpClientBuilder(ApacheHttpClient.builder()
                        .socketTimeout(RESPONSE_TIMEOUT))
                .overrideConfiguration(ClientOverrideConfiguration.builder()
                        .apiCallTimeout(RESPONSE_TIMEOUT)
                        .build())
                .build();
    }
}
