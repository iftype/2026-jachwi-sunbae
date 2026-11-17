package com.jachwisunbae.property.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.UpstreamServiceException;
import com.jachwisunbae.property.type.RoomOption;
import com.jachwisunbae.property.type.UtilityOption;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.model.ContentBlock;
import software.amazon.awssdk.services.bedrockruntime.model.ConversationRole;
import software.amazon.awssdk.services.bedrockruntime.model.ConverseOutput;
import software.amazon.awssdk.services.bedrockruntime.model.ConverseRequest;
import software.amazon.awssdk.services.bedrockruntime.model.ConverseResponse;
import software.amazon.awssdk.services.bedrockruntime.model.ImageFormat;
import software.amazon.awssdk.services.bedrockruntime.model.Message;
import software.amazon.awssdk.services.bedrockruntime.model.ReasoningContentBlock;
import software.amazon.awssdk.services.bedrockruntime.model.ReasoningTextBlock;
import software.amazon.awssdk.services.bedrockruntime.model.StopReason;
import software.amazon.awssdk.services.bedrockruntime.model.ThrottlingException;

class BedrockPropertyExtractorTest {

    private static final String MODEL_ID = "global.anthropic.claude-sonnet-5-5";
    private static final PropertyImage PNG = new PropertyImage(new byte[] {1, 2, 3}, "image/png");
    private static final PropertyImage JPEG = new PropertyImage(new byte[] {4, 5, 6}, "image/jpeg");

    private final BedrockRuntimeClient client = mock(BedrockRuntimeClient.class);
    // 2026-11-16 23:30 UTC는 서울 기준 2026-11-17이다.
    private final Clock clock = Clock.fixed(Instant.parse("2026-11-16T23:30:00Z"), ZoneOffset.UTC);
    private final BedrockPropertyExtractor extractor = new BedrockPropertyExtractor(
            client, new BedrockProperties("ap-northeast-2", MODEL_ID), new ObjectMapper(), clock);

    @Test
    @DisplayName("만원 단위 금액을 원으로, 날짜와 옵션 코드를 도메인 값으로 바꾼다")
    void convertsToDomainValues() {
        // given
        respond(ContentBlock.fromText("""
                {
                  "depositAmountManwon": 1000,
                  "monthlyRentAmountManwon": 55,
                  "maintenanceFeeAmountManwon": 7.5,
                  "availableMoveInDate": "2026-12-01",
                  "utilityOptions": ["WATER", "INTERNET"],
                  "roomOptions": ["AIR_CONDITIONER", "BED"],
                  "freeMemo": "3층, 엘리베이터 없음"
                }
                """));

        // when
        PropertyExtraction extraction = extractor.extract(List.of(PNG));

        // then
        assertThat(extraction).isEqualTo(new PropertyExtraction(
                10_000_000L, 550_000L, LocalDate.of(2026, 12, 1), 75_000L,
                Set.of(UtilityOption.WATER, UtilityOption.INTERNET),
                Set.of(RoomOption.AIR_CONDITIONER, RoomOption.BED),
                "3층, 엘리베이터 없음"));
    }

    @Test
    @DisplayName("null은 미추출로, 0과 빈 옵션 목록은 확인된 값으로 구분한다")
    void distinguishesNullFromZeroAndEmpty() {
        // given
        respond(ContentBlock.fromText("""
                {
                  "depositAmountManwon": 0,
                  "monthlyRentAmountManwon": null,
                  "maintenanceFeeAmountManwon": null,
                  "availableMoveInDate": null,
                  "utilityOptions": [],
                  "roomOptions": null,
                  "freeMemo": null
                }
                """));

        // when
        PropertyExtraction extraction = extractor.extract(List.of(PNG));

        // then
        assertThat(extraction.depositAmount()).isZero();
        assertThat(extraction.monthlyRentAmount()).isNull();
        assertThat(extraction.utilityOptions()).isEmpty();
        assertThat(extraction.roomOptions()).isNull();
        assertThat(extraction.freeMemo()).isNull();
    }

    @Test
    @DisplayName("코드 블록과 추론 블록이 섞인 응답에서 텍스트 블록의 JSON만 읽는다")
    void readsJsonFromTextBlockAmongReasoning() {
        // given
        ContentBlock reasoning = ContentBlock.fromReasoningContent(ReasoningContentBlock.fromReasoningText(
                ReasoningTextBlock.builder().text("{\"depositAmountManwon\": 1}").build()));
        respond(reasoning, ContentBlock.fromText("""
                ```json
                {"depositAmountManwon": 500}
                ```
                """));

        // when
        PropertyExtraction extraction = extractor.extract(List.of(PNG));

        // then
        assertThat(extraction.depositAmount()).isEqualTo(5_000_000L);
    }

    @Test
    @DisplayName("잘못된 필드 값은 그 필드만 미추출로 보고 모르는 옵션 코드는 버린다")
    void ignoresInvalidFieldValues() {
        // given
        respond(ContentBlock.fromText("""
                {
                  "depositAmountManwon": -10,
                  "monthlyRentAmountManwon": "55만원",
                  "availableMoveInDate": "즉시 입주",
                  "utilityOptions": ["SOFA"],
                  "roomOptions": ["BED", "SOFA"],
                  "freeMemo": "  "
                }
                """));

        // when
        PropertyExtraction extraction = extractor.extract(List.of(PNG));

        // then
        assertThat(extraction).isEqualTo(new PropertyExtraction(
                null, null, null, null, null, Set.of(RoomOption.BED), null));
    }

    @Test
    @DisplayName("이미지 여러 장과 서울 기준 오늘 날짜를 모델에 함께 보낸다")
    void sendsImagesWithTodayInSeoul() {
        // given
        respond(ContentBlock.fromText("{}"));

        // when
        extractor.extract(List.of(PNG, JPEG, PNG));

        // then
        ArgumentCaptor<ConverseRequest> captor = ArgumentCaptor.forClass(ConverseRequest.class);
        verify(client).converse(captor.capture());
        ConverseRequest request = captor.getValue();
        List<ContentBlock> content = request.messages().getFirst().content();
        assertThat(request.modelId()).isEqualTo(MODEL_ID);
        assertThat(content).hasSize(4);
        assertThat(content.subList(0, 3)).extracting(block -> block.image().format())
                .containsExactly(ImageFormat.PNG, ImageFormat.JPEG, ImageFormat.PNG);
        assertThat(content.get(3).text()).contains("2026-11-17");
    }

    @Test
    @DisplayName("JSON 객체가 없는 응답은 응답 오류로 처리한다")
    void rejectsResponseWithoutJson() {
        // given
        respond(ContentBlock.fromText("이미지에서 매물 정보를 찾을 수 없습니다."));

        // when & then
        assertThatThrownBy(() -> extractor.extract(List.of(PNG)))
                .isInstanceOf(UpstreamServiceException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.PROPERTY_AI_RESPONSE_INVALID);
    }

    @Test
    @DisplayName("Bedrock 호출 실패는 외부 서비스 오류로 바꾼다")
    void wrapsBedrockFailure() {
        // given
        when(client.converse(any(ConverseRequest.class)))
                .thenThrow(ThrottlingException.builder().message("rate exceeded").build());

        // when & then
        assertThatThrownBy(() -> extractor.extract(List.of(PNG)))
                .isInstanceOf(UpstreamServiceException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.PROPERTY_AI_PROVIDER_UNAVAILABLE);
    }

    private void respond(final ContentBlock... blocks) {
        when(client.converse(any(ConverseRequest.class))).thenReturn(ConverseResponse.builder()
                .output(ConverseOutput.fromMessage(Message.builder()
                        .role(ConversationRole.ASSISTANT)
                        .content(blocks)
                        .build()))
                .stopReason(StopReason.END_TURN)
                .build());
    }
}
