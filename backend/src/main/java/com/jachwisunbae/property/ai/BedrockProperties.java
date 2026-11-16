package com.jachwisunbae.property.ai;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "property.ai.bedrock")
public record BedrockProperties(
        String region,
        String modelId) {
}
