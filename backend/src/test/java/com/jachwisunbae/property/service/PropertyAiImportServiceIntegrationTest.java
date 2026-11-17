package com.jachwisunbae.property.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.jachwisunbae.common.exception.JachwiException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.UpstreamServiceException;
import com.jachwisunbae.property.ai.BedrockPropertyExtractor;
import com.jachwisunbae.property.ai.PropertyExtraction;
import com.jachwisunbae.property.ai.PropertyImage;
import com.jachwisunbae.property.entity.Property;
import com.jachwisunbae.property.repository.JdbcPropertyRepository;
import com.jachwisunbae.property.type.RoomOption;
import com.jachwisunbae.property.type.UtilityOption;
import com.zaxxer.hikari.HikariDataSource;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.sql.SQLException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.List;
import java.util.Set;
import java.util.stream.IntStream;
import javax.imageio.ImageIO;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

// Bedrock 호출은 비용과 AWS 인증이 필요하므로 추출기만 대역으로 두고, 검증·병합·저장은 실제 MySQL로 확인한다.
// 트랜잭션 롤백과 커넥션 점유를 실제 상태로 확인하려고 테스트에는 트랜잭션을 걸지 않고 매번 데이터를 지운다.
@Testcontainers
@SpringBootTest
@ActiveProfiles("test")
class PropertyAiImportServiceIntegrationTest {

    @Container
    @ServiceConnection
    private static final MySQLContainer<?> mysqlContainer = new MySQLContainer<>("mysql:8.4.10");

    private static final long MEMBER_ID = 1L;
    private static final long OTHER_MEMBER_ID = 2L;
    private static final byte[] PNG = Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");
    private static final byte[] JPEG = jpeg();
    private static final PropertyExtraction EXTRACTION = new PropertyExtraction(
            20_000_000L, 650_000L, LocalDate.of(2027, 1, 15), 80_000L,
            Set.of(UtilityOption.WATER, UtilityOption.INTERNET), null, "4층, 엘리베이터 있음");

    @Autowired
    private PropertyAiImportService service;

    @MockitoSpyBean
    private JdbcPropertyRepository repository;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private DataSource dataSource;

    @MockitoBean
    private BedrockPropertyExtractor extractor;

    private long propertyId;

    @BeforeEach
    void setUp() {
        jdbc.update("DELETE FROM property_room_options");
        jdbc.update("DELETE FROM property_utility_options");
        jdbc.update("DELETE FROM property_details");
        jdbc.update("DELETE FROM properties");
        jdbc.update("DELETE FROM refresh_tokens");
        jdbc.update("DELETE FROM members");
        insertMember(MEMBER_ID);
        insertMember(OTHER_MEMBER_ID);
        propertyId = saveProperty(MEMBER_ID);
    }

    @Test
    @DisplayName("이미지 1장을 분석해 추출 값은 반영하고 읽지 못한 값과 다른 정보는 유지하며 메모는 뒤에 덧붙인다")
    void importsSingleImageAndMergesIntoProperty() {
        // given
        given(extractor.extract(anyList())).willReturn(EXTRACTION);

        // when
        service.importFromImages(MEMBER_ID, propertyId, List.of(png("capture.png")));

        // then
        Property saved = findSaved();
        assertThat(saved).extracting(Property::getDepositAmount, Property::getMonthlyRentAmount,
                        Property::getAvailableMoveInDate, Property::getMaintenanceFeeAmount)
                .containsExactly(20_000_000L, 650_000L, LocalDate.of(2027, 1, 15), 80_000L);
        assertThat(saved.getUtilityOptions()).containsExactlyInAnyOrder(UtilityOption.WATER, UtilityOption.INTERNET);
        assertThat(saved.getRoomOptions()).containsExactlyInAnyOrder(RoomOption.BED, RoomOption.DESK);
        assertThat(saved).extracting(Property::getName, Property::getAddress, Property::getDiscoverySource)
                .containsExactly("판교 원룸", "경기도 성남시 분당구 판교역로 166", "직방");
        assertThat(saved.getMemo()).isEqualTo("남향\n\n4층, 엘리베이터 있음");
    }

    @Test
    @DisplayName("이미지 10장을 고른 순서대로 형식을 정리해 한 번에 분석에 넘긴다")
    void passesTenImagesToExtractor() {
        // given
        given(extractor.extract(anyList())).willReturn(EXTRACTION);
        List<MultipartFile> files = IntStream.range(0, 10)
                .mapToObj(index -> index % 2 == 0 ? png("capture" + index + ".png") : jpeg("capture" + index + ".jpg"))
                .toList();

        // when
        service.importFromImages(MEMBER_ID, propertyId, files);

        // then
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<PropertyImage>> captor = ArgumentCaptor.forClass(List.class);
        verify(extractor).extract(captor.capture());
        assertThat(captor.getValue()).extracting(PropertyImage::contentType)
                .containsExactly("image/png", "image/jpeg", "image/png", "image/jpeg", "image/png",
                        "image/jpeg", "image/png", "image/jpeg", "image/png", "image/jpeg");
    }

    @Test
    @DisplayName("Bedrock 응답을 기다리는 동안 트랜잭션과 DB 커넥션을 잡지 않는다")
    void analyzesWithoutHoldingConnection() throws SQLException {
        // given
        AtomicBoolean transactionActive = new AtomicBoolean(true);
        AtomicInteger activeConnections = new AtomicInteger(-1);
        HikariDataSource pool = dataSource.unwrap(HikariDataSource.class);
        given(extractor.extract(anyList())).willAnswer(invocation -> {
            transactionActive.set(TransactionSynchronizationManager.isActualTransactionActive());
            activeConnections.set(pool.getHikariPoolMXBean().getActiveConnections());
            return EXTRACTION;
        });

        // when
        service.importFromImages(MEMBER_ID, propertyId, List.of(png("capture.png")));

        // then
        assertThat(transactionActive).isFalse();
        assertThat(activeConnections).hasValue(0);
        assertThat(findSaved().getDepositAmount()).isEqualTo(20_000_000L);
    }

    @Test
    @DisplayName("이미지가 없거나 10장을 넘거나 3MB를 넘으면 분석하지 않는다")
    void rejectsInvalidImageCountOrSize() {
        // given
        List<MultipartFile> eleven = IntStream.range(0, 11).mapToObj(index -> png("capture.png")).toList();
        MultipartFile tooLarge = new MockMultipartFile("images", "large.png", "image/png",
                new byte[3 * 1024 * 1024 + 1]);

        // when & then
        assertError(() -> service.importFromImages(MEMBER_ID, propertyId, List.of()),
                ErrorCode.PROPERTY_AI_IMAGE_INVALID);
        assertError(() -> service.importFromImages(MEMBER_ID, propertyId, eleven),
                ErrorCode.PROPERTY_AI_IMAGE_INVALID);
        assertError(() -> service.importFromImages(MEMBER_ID, propertyId, List.of(tooLarge)),
                ErrorCode.PROPERTY_AI_IMAGE_INVALID);
        verifyNoInteractions(extractor);
    }

    @Test
    @DisplayName("PNG·JPEG가 아니거나 내용이 형식과 다르면 분석하지 않는다")
    void rejectsUnsupportedImageFormat() {
        // given
        MultipartFile webp = new MockMultipartFile("images", "capture.webp", "image/webp", PNG);
        MultipartFile fakePng = new MockMultipartFile("images", "capture.png", "image/png", "not image".getBytes());

        // when & then
        assertError(() -> service.importFromImages(MEMBER_ID, propertyId, List.of(webp)),
                ErrorCode.PHOTO_CONTENT_TYPE_UNSUPPORTED);
        assertError(() -> service.importFromImages(MEMBER_ID, propertyId, List.of(fakePng)),
                ErrorCode.PHOTO_CONTENT_TYPE_UNSUPPORTED);
        verifyNoInteractions(extractor);
    }

    @Test
    @DisplayName("다른 회원의 매물이면 Bedrock을 호출하지 않는다")
    void rejectsOtherMembersPropertyBeforeAnalysis() {
        // when & then
        assertError(() -> service.importFromImages(OTHER_MEMBER_ID, propertyId, List.of(png("capture.png"))),
                ErrorCode.PROPERTY_NOT_FOUND);
        verifyNoInteractions(extractor);
    }

    @Test
    @DisplayName("이미지 분석이 실패하면 매물 정보와 메모를 바꾸지 않는다")
    void keepsPropertyWhenAnalysisFails() {
        // given
        given(extractor.extract(anyList())).willThrow(new UpstreamServiceException(
                ErrorCode.PROPERTY_AI_PROVIDER_UNAVAILABLE, "Bedrock 호출 실패"));

        // when & then
        assertError(() -> service.importFromImages(MEMBER_ID, propertyId, List.of(png("capture.png"))),
                ErrorCode.PROPERTY_AI_PROVIDER_UNAVAILABLE);
        assertUnchanged();
    }

    @Test
    @DisplayName("메모 저장이 실패하면 먼저 저장한 기본 정보와 부가 정보도 함께 되돌린다")
    void rollsBackBasicInfoWhenMemoSaveFails() {
        // given
        given(extractor.extract(anyList())).willReturn(EXTRACTION);
        doThrow(new IllegalStateException("메모 저장 실패")).when(repository).updateMemo(any());

        // when & then
        assertThatThrownBy(() -> service.importFromImages(MEMBER_ID, propertyId, List.of(png("capture.png"))))
                .isInstanceOf(IllegalStateException.class);
        assertUnchanged();
    }

    private void assertUnchanged() {
        Property saved = findSaved();
        assertThat(saved).extracting(Property::getDepositAmount, Property::getMonthlyRentAmount,
                        Property::getAvailableMoveInDate, Property::getMaintenanceFeeAmount, Property::getMemo)
                .containsExactly(1000L, 50L, LocalDate.of(2026, 12, 1), 7L, "남향");
        assertThat(saved.getUtilityOptions()).containsExactly(UtilityOption.WATER);
    }

    private Property findSaved() {
        return repository.findByIdAndMemberId(propertyId, MEMBER_ID).orElseThrow();
    }

    private long saveProperty(final long memberId) {
        Property property = repository.save(Property.create(memberId, "판교 원룸", 1000L, 50L,
                "경기도 성남시 분당구 판교역로 166", new BigDecimal("37.3948000"), new BigDecimal("127.1112000"),
                LocalDate.of(2026, 12, 1), 7L, LocalDateTime.of(2026, 11, 10, 14, 0),
                List.of("BED", "DESK"), List.of("WATER"), "직방", LocalDateTime.of(2026, 11, 1, 9, 0)));
        property.replaceMemo("남향");
        repository.updateMemo(property);
        return property.getId();
    }

    private void insertMember(final long id) {
        jdbc.update("INSERT INTO members (id, created_at, updated_at) VALUES (?, NOW(6), NOW(6))", id);
    }

    private void assertError(final Executable executable, final ErrorCode errorCode) {
        assertThatThrownBy(executable::execute)
                .isInstanceOfSatisfying(JachwiException.class,
                        exception -> assertThat(exception.getErrorCode()).isEqualTo(errorCode));
    }

    private static MultipartFile png(final String name) {
        return new MockMultipartFile("images", name, "image/png", PNG);
    }

    private static MultipartFile jpeg(final String name) {
        return new MockMultipartFile("images", name, "image/jpeg", JPEG);
    }

    private static byte[] jpeg() {
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            ImageIO.write(new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB), "jpg", output);
            return output.toByteArray();
        } catch (IOException exception) {
            throw new UncheckedIOException(exception);
        }
    }
}
