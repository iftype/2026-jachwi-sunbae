package com.jachwisunbae.property.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.UpstreamServiceException;
import com.jachwisunbae.property.type.RoomOption;
import com.jachwisunbae.property.type.UtilityOption;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.model.ContentBlock;
import software.amazon.awssdk.services.bedrockruntime.model.ConversationRole;
import software.amazon.awssdk.services.bedrockruntime.model.ConverseRequest;
import software.amazon.awssdk.services.bedrockruntime.model.ConverseResponse;
import software.amazon.awssdk.services.bedrockruntime.model.ImageBlock;
import software.amazon.awssdk.services.bedrockruntime.model.ImageFormat;
import software.amazon.awssdk.services.bedrockruntime.model.ImageSource;
import software.amazon.awssdk.services.bedrockruntime.model.InferenceConfiguration;
import software.amazon.awssdk.services.bedrockruntime.model.Message;
import software.amazon.awssdk.services.bedrockruntime.model.SystemContentBlock;

@Component
public class BedrockPropertyExtractor {

    private static final int MAX_TOKENS = 16_000;
    private static final BigDecimal WON_PER_MANWON = BigDecimal.valueOf(10_000);
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final String SYSTEM_PROMPT = """
            너는 한국 부동산 매물 캡처 이미지에서 정보를 읽는 도우미다.
            이미지에 보이는 내용만 사용하고 추측하지 않는다. 읽을 수 없거나 이미지에 없는 값은 null로 둔다.
            0과 null은 다르다. 이미지에 0원 또는 없음이라고 적힌 금액만 0으로 둔다.

            다른 설명 없이 아래 JSON 객체 하나만 응답한다.
            {
              "depositAmountManwon": 숫자 또는 null,
              "monthlyRentAmountManwon": 숫자 또는 null,
              "maintenanceFeeAmountManwon": 숫자 또는 null,
              "availableMoveInDate": "YYYY-MM-DD" 또는 null,
              "utilityOptions": 코드 배열 또는 null,
              "roomOptions": 코드 배열 또는 null,
              "freeMemo": 문자열 또는 null
            }

            - 금액은 모두 만원 단위 숫자다. 예: 보증금 1000만원 -> 1000, 관리비 7만 5천원 -> 7.5, 1억 -> 10000
            - 입주 가능일은 날짜를 특정할 수 있을 때만 적는다. 연도가 없으면 오늘 날짜를 기준으로 가장 가까운 미래의 날짜로 정한다.
              즉시 입주, 협의 가능처럼 날짜가 아닌 내용은 null로 두고 freeMemo에 적는다.
            - utilityOptions는 관리비에 포함된 공과금이다. 사용 가능한 코드: WATER, ELECTRICITY, GAS, INTERNET
            - roomOptions는 방에 있는 옵션이다. 사용 가능한 코드: AIR_CONDITIONER, REFRIGERATOR, WASHING_MACHINE,
              SINK, GAS_STOVE, MICROWAVE, SHOE_CABINET, WARDROBE, BED, DESK, TV, INDUCTION
            - 옵션 목록이 이미지에 있으나 해당 코드가 하나도 없으면 []로, 옵션 정보 자체가 없으면 null로 둔다.
            - freeMemo에는 위 항목에 넣지 못한 유용한 정보(층수, 면적, 방 구조, 주차, 엘리베이터, 반려동물, 입주 조건 등)를
              한국어로 짧게 정리한다. 500자를 넘기지 않는다. 적을 내용이 없으면 null로 둔다.
            """;

    private final BedrockRuntimeClient client;
    private final BedrockProperties properties;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public BedrockPropertyExtractor(final BedrockRuntimeClient client, final BedrockProperties properties,
                                    final ObjectMapper objectMapper, final Clock clock) {
        this.client = client;
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    public PropertyExtraction extract(final List<PropertyImage> images) {
        ConverseResponse response = converse(images);
        return parse(responseText(response));
    }

    private ConverseResponse converse(final List<PropertyImage> images) {
        List<ContentBlock> content = new ArrayList<>();
        images.forEach(image -> content.add(ContentBlock.fromImage(toImageBlock(image))));
        content.add(ContentBlock.fromText(
                "오늘 날짜는 " + LocalDate.now(clock.withZone(SEOUL)) + "이다. 이미지의 매물 정보를 JSON으로 추출해 줘."));

        ConverseRequest request = ConverseRequest.builder()
                .modelId(properties.modelId())
                .system(SystemContentBlock.fromText(SYSTEM_PROMPT))
                .messages(Message.builder()
                        .role(ConversationRole.USER)
                        .content(content)
                        .build())
                .inferenceConfig(InferenceConfiguration.builder()
                        .maxTokens(MAX_TOKENS)
                        .build())
                .build();
        try {
            return client.converse(request);
        } catch (SdkException exception) {
            throw new UpstreamServiceException(ErrorCode.PROPERTY_AI_PROVIDER_UNAVAILABLE,
                    "Bedrock 매물 이미지 분석을 호출하지 못했습니다.", exception);
        }
    }

    private ImageBlock toImageBlock(final PropertyImage image) {
        return ImageBlock.builder()
                .format(toImageFormat(image.contentType()))
                .source(ImageSource.fromBytes(SdkBytes.fromByteArray(image.content())))
                .build();
    }

    private ImageFormat toImageFormat(final String contentType) {
        return switch (contentType) {
            case "image/png" -> ImageFormat.PNG;
            case "image/jpeg", "image/jpg" -> ImageFormat.JPEG;
            default -> throw new IllegalArgumentException("지원하지 않는 이미지 형식입니다: " + contentType);
        };
    }

    // 추론 블록(reasoningContent)이 함께 올 수 있어 텍스트 블록만 모은다.
    private String responseText(final ConverseResponse response) {
        if (response.output() == null || response.output().message() == null) {
            throw invalidResponse("Bedrock 응답에 메시지가 없습니다. stopReason=" + response.stopReasonAsString());
        }
        String text = response.output().message().content().stream()
                .map(ContentBlock::text)
                .filter(blockText -> blockText != null)
                .collect(Collectors.joining());
        if (text.isBlank()) {
            throw invalidResponse("Bedrock 응답에 텍스트가 없습니다. stopReason=" + response.stopReasonAsString());
        }
        return text;
    }

    private PropertyExtraction parse(final String text) {
        JsonNode root = readJsonObject(text);
        return new PropertyExtraction(
                toWon(root.get("depositAmountManwon")),
                toWon(root.get("monthlyRentAmountManwon")),
                toDate(root.get("availableMoveInDate")),
                toWon(root.get("maintenanceFeeAmountManwon")),
                toOptions(root.get("utilityOptions"), UtilityOption.class),
                toOptions(root.get("roomOptions"), RoomOption.class),
                toMemo(root.get("freeMemo")));
    }

    // 모델이 JSON을 ```json 코드 블록이나 설명 문장으로 감쌀 수 있어 가장 바깥 중괄호 사이만 읽는다.
    private JsonNode readJsonObject(final String text) {
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start < 0 || end < start) {
            throw invalidResponse("Bedrock 응답에서 JSON 객체를 찾지 못했습니다.");
        }
        try {
            JsonNode root = objectMapper.readTree(text.substring(start, end + 1));
            if (!root.isObject()) {
                throw invalidResponse("Bedrock 응답이 JSON 객체가 아닙니다.");
            }
            return root;
        } catch (JsonProcessingException exception) {
            throw invalidResponse("Bedrock 응답 JSON을 읽지 못했습니다.");
        }
    }

    // 필드 하나가 잘못되어도 나머지 값은 살리도록 잘못된 값은 미추출(null)로 본다.
    private Long toWon(final JsonNode node) {
        if (node == null || !node.isNumber()) {
            return null;
        }
        BigDecimal manwon = node.decimalValue();
        if (manwon.signum() < 0) {
            return null;
        }
        return manwon.multiply(WON_PER_MANWON).setScale(0, RoundingMode.HALF_UP).longValue();
    }

    private LocalDate toDate(final JsonNode node) {
        if (node == null || !node.isTextual()) {
            return null;
        }
        try {
            return LocalDate.parse(node.asText().strip());
        } catch (DateTimeParseException exception) {
            return null;
        }
    }

    private <E extends Enum<E>> Set<E> toOptions(final JsonNode node, final Class<E> type) {
        if (node == null || !node.isArray()) {
            return null;
        }
        Set<String> codes = Arrays.stream(type.getEnumConstants())
                .map(Enum::name)
                .collect(Collectors.toSet());
        Set<E> options = EnumSet.noneOf(type);
        node.forEach(element -> {
            String code = element.asText().strip();
            if (codes.contains(code)) {
                options.add(Enum.valueOf(type, code));
            }
        });
        // 모르는 코드만 있으면 옵션이 없다고 확인한 것이 아니므로 미추출로 본다.
        if (options.isEmpty() && !node.isEmpty()) {
            return null;
        }
        return Set.copyOf(options);
    }

    private String toMemo(final JsonNode node) {
        if (node == null || !node.isTextual() || node.asText().isBlank()) {
            return null;
        }
        return node.asText().strip();
    }

    private UpstreamServiceException invalidResponse(final String message) {
        return new UpstreamServiceException(ErrorCode.PROPERTY_AI_RESPONSE_INVALID, message);
    }
}
