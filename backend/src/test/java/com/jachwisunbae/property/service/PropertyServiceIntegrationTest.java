package com.jachwisunbae.property.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.checklist.type.CheckStage;
import com.jachwisunbae.common.exception.JachwiException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.property.ai.PropertyExtraction;
import com.jachwisunbae.property.controller.dto.request.CreatePropertyRequest;
import com.jachwisunbae.property.controller.dto.request.UpdatePropertyMemoRequest;
import com.jachwisunbae.property.controller.dto.request.UpdatePropertyRequest;
import com.jachwisunbae.property.controller.dto.response.PropertyChecklistStageResponse;
import com.jachwisunbae.property.controller.dto.response.PropertyDetailResponse;
import com.jachwisunbae.property.controller.dto.response.PropertyListItemResponse;
import com.jachwisunbae.property.entity.Property;
import com.jachwisunbae.property.repository.JdbcPropertyRepository;
import com.jachwisunbae.property.type.RoomOption;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PropertyServiceIntegrationTest {

    @Container
    @ServiceConnection
    private static final MySQLContainer<?> mysqlContainer = new MySQLContainer<>("mysql:8.4.10");

    private static final long MEMBER_ID = 1L;
    private static final long OTHER_MEMBER_ID = 2L;
    private static final long MISSING_MEMBER_ID = 99L;

    @Autowired
    private PropertyService service;

    @Autowired
    private JdbcPropertyRepository repository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        insertMember(MEMBER_ID);
        insertMember(OTHER_MEMBER_ID);
    }

    @Test
    @DisplayName("매물을 만들면 입력한 정보를 저장하고 현장 체크리스트를 자동으로 적용한다")
    void createsPropertyWithInitialChecklist() {
        // when
        Property property = service.create(MEMBER_ID, createRequest("판교 원룸"));

        // then
        assertThat(repository.findByIdAndMemberId(property.getId(), MEMBER_ID)).get()
                .extracting(Property::getName, Property::getDepositAmount, Property::getMonthlyRentAmount,
                        Property::getAvailableMoveInDate)
                .containsExactly("판교 원룸", 1000L, 50L, LocalDate.of(2026, 12, 1));
        assertThat(checklistCount(property.getId(), "ON_SITE")).isOne();
    }

    @Test
    @DisplayName("회원당 매물은 30개까지 만들 수 있고 삭제한 매물은 개수에 넣지 않는다")
    void limitsPropertiesPerMember() {
        // given
        for (int count = 0; count < 29; count++) {
            insertProperty(MEMBER_ID, "집 " + count);
        }
        long deleted = insertProperty(MEMBER_ID, "삭제한 집");
        jdbcTemplate.update("UPDATE properties SET deleted_at = NOW(6) WHERE id = ?", deleted);

        // when
        service.create(MEMBER_ID, createRequest("서른 번째 집"));

        // then
        assertError(() -> service.create(MEMBER_ID, createRequest("서른한 번째 집")),
                ErrorCode.PROPERTY_LIMIT_EXCEEDED);
        assertThat(repository.countByMemberId(MEMBER_ID)).isEqualTo(30);
    }

    @Test
    @DisplayName("없는 회원은 매물을 만들 수 없다")
    void rejectsMissingMember() {
        // when & then
        assertError(() -> service.create(MISSING_MEMBER_ID, createRequest("판교 원룸")), ErrorCode.MEMBER_NOT_FOUND);
    }

    @Test
    @DisplayName("매물을 수정하면 기본 정보와 옵션을 요청한 값으로 바꾼다")
    void updatesProperty() {
        // given
        Property property = service.create(MEMBER_ID, createRequest("판교 원룸"));

        // when
        service.update(MEMBER_ID, property.getId(), new UpdatePropertyRequest("정자 투룸", 2000L, 70L,
                "경기도 성남시 분당구 정자일로 95", new BigDecimal("37.3595000"), new BigDecimal("127.1052000"), null, 10L,
                null, "다방", List.of("BED"), List.of()));

        // then
        Property updated = repository.findByIdAndMemberId(property.getId(), MEMBER_ID).orElseThrow();
        assertThat(updated).extracting(Property::getName, Property::getDepositAmount, Property::getMonthlyRentAmount,
                        Property::getAddress, Property::getMaintenanceFeeAmount, Property::getDiscoverySource)
                .containsExactly("정자 투룸", 2000L, 70L, "경기도 성남시 분당구 정자일로 95", 10L, "다방");
        assertThat(updated.getRoomOptions()).containsExactly(RoomOption.BED);
        assertThat(updated.getUtilityOptions()).isEmpty();
    }

    @Test
    @DisplayName("메모를 저장하고 다시 읽어도 유지한다")
    void savesMemo() {
        // given
        Property property = service.create(MEMBER_ID, createRequest("판교 원룸"));

        // when
        service.updateMemoByMemberIdAndPropertyId(MEMBER_ID, property.getId(),
                new UpdatePropertyMemoRequest("아침에 해가 잘 든다"));

        // then
        assertThat(service.findMemoByMemberIdAndPropertyId(MEMBER_ID, property.getId())).isEqualTo("아침에 해가 잘 든다");
    }

    @Test
    @DisplayName("AI 추출 값만 반영하고 읽지 못한 값과 추출 대상이 아닌 값은 그대로 둔다")
    void appliesOnlyExtractedValues() {
        // given
        Property property = service.create(MEMBER_ID, createRequest("판교 원룸"));
        PropertyExtraction extraction = new PropertyExtraction(
                20_000_000L, null, null, 0L, Set.of(), null, null);

        // when
        service.applyAiExtraction(MEMBER_ID, property.getId(), extraction);

        // then
        Property updated = repository.findByIdAndMemberId(property.getId(), MEMBER_ID).orElseThrow();
        assertThat(updated).extracting(Property::getDepositAmount, Property::getMonthlyRentAmount,
                        Property::getAvailableMoveInDate, Property::getMaintenanceFeeAmount)
                .containsExactly(20_000_000L, 50L, LocalDate.of(2026, 12, 1), 0L);
        assertThat(updated.getUtilityOptions()).isEmpty();
        assertThat(updated.getRoomOptions()).containsExactlyInAnyOrder(RoomOption.BED, RoomOption.DESK);
        assertThat(updated).extracting(Property::getName, Property::getAddress, Property::getDiscoverySource,
                        Property::getVisitScheduledAt)
                .containsExactly("판교 원룸", "경기도 성남시 분당구 판교역로 166", "직방",
                        LocalDateTime.of(2026, 11, 10, 14, 0));
    }

    @Test
    @DisplayName("AI 추출 메모는 기존 메모 뒤에 덧붙인다")
    void appendsExtractedMemo() {
        // given
        Property property = service.create(MEMBER_ID, createRequest("판교 원룸"));
        service.updateMemoByMemberIdAndPropertyId(MEMBER_ID, property.getId(),
                new UpdatePropertyMemoRequest("아침에 해가 잘 든다"));
        PropertyExtraction extraction = new PropertyExtraction(
                null, null, null, null, null, null, "3층, 엘리베이터 없음");

        // when
        service.applyAiExtraction(MEMBER_ID, property.getId(), extraction);

        // then
        assertThat(service.findMemoByMemberIdAndPropertyId(MEMBER_ID, property.getId()))
                .isEqualTo("아침에 해가 잘 든다\n\n3층, 엘리베이터 없음");
    }

    @Test
    @DisplayName("덧붙인 메모가 2,000자를 넘으면 기존 메모는 지키고 추출 메모를 잘라 저장한다")
    void truncatesExtractedMemoToMemoLimit() {
        // given
        Property property = service.create(MEMBER_ID, createRequest("판교 원룸"));
        String currentMemo = "가".repeat(1_990);
        service.updateMemoByMemberIdAndPropertyId(MEMBER_ID, property.getId(),
                new UpdatePropertyMemoRequest(currentMemo));
        PropertyExtraction extraction = new PropertyExtraction(
                30_000_000L, null, null, null, null, null, "나".repeat(100));

        // when
        service.applyAiExtraction(MEMBER_ID, property.getId(), extraction);

        // then
        assertThat(service.findMemoByMemberIdAndPropertyId(MEMBER_ID, property.getId()))
                .isEqualTo(currentMemo + "\n\n" + "나".repeat(8));
        assertThat(repository.findByIdAndMemberId(property.getId(), MEMBER_ID).orElseThrow().getDepositAmount())
                .isEqualTo(30_000_000L);
    }

    @Test
    @DisplayName("상세는 사진, 대표 사진, 체크 진행률을 함께 보여 준다")
    void findsDetailWithPhotosAndProgress() {
        // given
        Property property = service.create(MEMBER_ID, createRequest("판교 원룸"));
        long photoId = insertPhoto(property.getId(), "photos/detail.png");
        jdbcTemplate.update("INSERT INTO main_property_photos (property_id, property_photos_id) VALUES (?, ?)",
                property.getId(), photoId);

        // when
        PropertyDetailResponse detail = service.findDetail(MEMBER_ID, property.getId());

        // then
        assertThat(detail.id()).isEqualTo(property.getId());
        assertThat(detail.photoCount()).isOne();
        assertThat(detail.representativePhoto().id()).isEqualTo(photoId);
        assertThat(detail.overallProgress().totalCount()).isPositive();
        assertThat(detail.overallProgress().completedCount()).isZero();
    }

    @Test
    @DisplayName("목록은 회원의 매물만 보여 주고 다른 회원의 매물은 섞지 않는다")
    void findsOwnPropertiesOnly() {
        // given
        Property own = service.create(MEMBER_ID, createRequest("판교 원룸"));
        service.create(OTHER_MEMBER_ID, createRequest("남의 집"));

        // when & then
        assertThat(service.findList(MEMBER_ID).items()).extracting(PropertyListItemResponse::id)
                .containsExactly(own.getId());
    }

    @Test
    @DisplayName("목록은 매물마다 그 매물의 단계별 진행 현황을 붙인다")
    void attachesEachPropertysStageProgressInList() {
        // given
        Property checked = service.create(MEMBER_ID, createRequest("판교 원룸"));
        Property unchecked = service.create(MEMBER_ID, createRequest("정자 투룸"));
        markFirstItem(checked.getId(), "GOOD");

        // when
        Map<Long, PropertyListItemResponse> items = service.findList(MEMBER_ID).items().stream()
                .collect(Collectors.toMap(PropertyListItemResponse::id, Function.identity()));

        // then
        PropertyChecklistStageResponse checkedOnSite = stage(items.get(checked.getId()), CheckStage.ON_SITE);
        PropertyChecklistStageResponse uncheckedOnSite = stage(items.get(unchecked.getId()), CheckStage.ON_SITE);
        assertThat(checkedOnSite.propertyChecklistId()).isEqualTo(checklistId(checked.getId(), "ON_SITE"));
        assertThat(uncheckedOnSite.propertyChecklistId()).isEqualTo(checklistId(unchecked.getId(), "ON_SITE"));
        assertThat(checkedOnSite.progress().goodCount()).isOne();
        assertThat(uncheckedOnSite.progress().goodCount()).isZero();
        assertThat(items.get(checked.getId()).overallProgress().completedCount()).isOne();
    }

    @Test
    @DisplayName("다른 회원의 매물은 조회, 수정, 메모 저장 모두 찾을 수 없다")
    void rejectsOtherMembersProperty() {
        // given
        Property property = service.create(OTHER_MEMBER_ID, createRequest("남의 집"));

        // when & then
        assertError(() -> service.findDetail(MEMBER_ID, property.getId()), ErrorCode.PROPERTY_NOT_FOUND);
        assertError(() -> service.update(MEMBER_ID, property.getId(), new UpdatePropertyRequest("바꾼 이름", 1L, 1L,
                null, null, null, null, null, null, null, List.of(), List.of())), ErrorCode.PROPERTY_NOT_FOUND);
        assertError(() -> service.updateMemoByMemberIdAndPropertyId(MEMBER_ID, property.getId(),
                new UpdatePropertyMemoRequest("메모")), ErrorCode.PROPERTY_NOT_FOUND);
        assertThat(repository.findByIdAndMemberId(property.getId(), OTHER_MEMBER_ID)).get()
                .extracting(Property::getName, Property::getMemo).containsExactly("남의 집", "");
    }

    private CreatePropertyRequest createRequest(String name) {
        return new CreatePropertyRequest(name, 1000L, 50L, "경기도 성남시 분당구 판교역로 166",
                new BigDecimal("37.3948000"), new BigDecimal("127.1112000"), LocalDate.of(2026, 12, 1), 7L,
                LocalDateTime.of(2026, 11, 10, 14, 0), "직방", List.of("BED", "DESK"), List.of("WATER"));
    }

    private void assertError(Executable executable, ErrorCode errorCode) {
        assertThatThrownBy(executable::execute)
                .isInstanceOfSatisfying(JachwiException.class,
                        exception -> assertThat(exception.getErrorCode()).isEqualTo(errorCode));
    }

    private int checklistCount(long propertyId, String stage) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM property_checklists WHERE property_id = ? AND stage = ?",
                Integer.class, propertyId, stage);
    }

    private PropertyChecklistStageResponse stage(PropertyListItemResponse item, CheckStage stage) {
        return item.stages().stream().filter(response -> response.stage() == stage).findFirst().orElseThrow();
    }

    private long checklistId(long propertyId, String stage) {
        return jdbcTemplate.queryForObject("SELECT id FROM property_checklists WHERE property_id = ? AND stage = ?",
                Long.class, propertyId, stage);
    }

    private void markFirstItem(long propertyId, String status) {
        jdbcTemplate.update("""
                UPDATE property_checklist_items SET status = ?
                WHERE property_checklist_id = ? ORDER BY display_order, id LIMIT 1
                """, status, checklistId(propertyId, "ON_SITE"));
    }

    private void insertMember(long id) {
        jdbcTemplate.update("INSERT INTO members (id, created_at, updated_at) VALUES (?, NOW(6), NOW(6))", id);
    }

    private long insertProperty(long memberId, String name) {
        jdbcTemplate.update("INSERT INTO properties (member_id, name, created_at) VALUES (?, ?, NOW(6))",
                memberId, name);
        return jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
    }

    private long insertPhoto(long propertyId, String storageKey) {
        jdbcTemplate.update("""
                INSERT INTO property_photos (property_id, member_id, storage_key, content_type, size_bytes, created_at)
                VALUES (?, ?, ?, 'image/png', 68, NOW(6))
                """, propertyId, MEMBER_ID, storageKey);
        return jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
    }
}
