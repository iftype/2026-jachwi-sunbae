package com.jachwisunbae.property.ai;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;

// 실제 Bedrock을 호출해 비용이 들고 AWS 자격 증명이 필요하다. 환경 변수로 이미지를 지정할 때만 실행한다.
// BEDROCK_LIVE_IMAGES=/path/a.png,/path/b.jpg ./gradlew test --tests '*BedrockPropertyExtractorLiveTest' -i
@Tag("bedrock-live")
@EnabledIfEnvironmentVariable(named = "BEDROCK_LIVE_IMAGES", matches = ".+")
class BedrockPropertyExtractorLiveTest {

    private static final BedrockProperties PROPERTIES =
            new BedrockProperties("ap-northeast-2", "global.anthropic.claude-sonnet-5-5");

    @Test
    @DisplayName("실제 매물 캡처 이미지를 Bedrock으로 분석해 매물 정보 DTO로 바꾼다")
    void extractsPropertyFromRealImages() {
        // given
        List<PropertyImage> images = Arrays.stream(System.getenv("BEDROCK_LIVE_IMAGES").split(","))
                .map(String::strip)
                .map(Path::of)
                .map(BedrockPropertyExtractorLiveTest::readImage)
                .toList();

        try (BedrockRuntimeClient client = new BedrockConfig().bedrockRuntimeClient(PROPERTIES)) {
            BedrockPropertyExtractor extractor =
                    new BedrockPropertyExtractor(client, PROPERTIES, new ObjectMapper(), Clock.systemUTC());

            // when
            PropertyExtraction extraction = extractor.extract(images);

            // then
            System.out.println("Bedrock 추출 결과: " + extraction);
            assertThat(extraction).isNotNull();
        }
    }

    private static PropertyImage readImage(final Path path) {
        String name = path.getFileName().toString().toLowerCase(Locale.ROOT);
        String contentType = name.endsWith(".png") ? "image/png" : "image/jpeg";
        try {
            return new PropertyImage(Files.readAllBytes(path), contentType);
        } catch (IOException exception) {
            throw new IllegalArgumentException("이미지를 읽지 못했습니다: " + path, exception);
        }
    }
}
