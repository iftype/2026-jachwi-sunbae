package com.jachwisunbae.property.service;

import com.jachwisunbae.common.exception.client.BusinessRuleViolationException;
import com.jachwisunbae.common.exception.client.ResourceNotFoundException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.member.repository.MemberRepository;
import com.jachwisunbae.property.ai.PropertyExtraction;
import com.jachwisunbae.property.controller.dto.request.CreatePropertyRequest;
import com.jachwisunbae.property.controller.dto.request.UpdatePropertyMemoRequest;
import com.jachwisunbae.property.controller.dto.request.UpdatePropertyRequest;
import com.jachwisunbae.property.controller.dto.response.PropertyDetailResponse;
import com.jachwisunbae.property.controller.dto.response.PropertyProgress;
import com.jachwisunbae.property.entity.Property;
import com.jachwisunbae.property.repository.PropertyPhotoRepository;
import com.jachwisunbae.property.repository.PropertyProgressRepository;
import com.jachwisunbae.property.repository.PropertyRepository;
import com.jachwisunbae.property.repository.query.PropertyChecklistProgressQuery;
import com.jachwisunbae.property.service.dto.result.PropertyListItemResult;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class PropertyService {
    // PropertyMemo의 자유 메모 길이 제한과 같다.
    private static final int MAX_MEMO_LENGTH = 2000;

    private final PropertyRepository propertyRepository;
    private final MemberRepository memberRepository;
    private final PropertyPhotoRepository propertyPhotoRepository;
    private final PropertyProgressRepository propertyProgressRepository;
    private final PropertyChecklistService propertyChecklistService;
    private final Clock clock;

    public PropertyService(final PropertyRepository propertyRepository,
                           final MemberRepository memberRepository,
                           final PropertyPhotoRepository propertyPhotoRepository,
                           final PropertyProgressRepository propertyProgressRepository,
                           final PropertyChecklistService propertyChecklistService,
                           final Clock clock) {
        this.propertyRepository = propertyRepository;
        this.memberRepository = memberRepository;
        this.propertyPhotoRepository = propertyPhotoRepository;
        this.propertyProgressRepository = propertyProgressRepository;
        this.propertyChecklistService = propertyChecklistService;
        this.clock = clock;
    }

    // 목록 응답(사진 주소, 진행률)은 Controller DTO가 만든다. 서비스는 조회한 데이터만 돌려준다.
    // 단계별 진행 현황은 매물마다 따로 읽지 않고 회원 단위로 한 번에 읽어 매물별로 나눈다.
    public List<PropertyListItemResult> findList(final Long memberId) {
        Map<Long, List<PropertyChecklistProgressQuery>> progressByProperty =
            propertyProgressRepository.findByMemberIdAndStage(memberId).stream()
                .collect(Collectors.groupingBy(query -> query.progress().propertyId()));
        return propertyRepository.findListByMemberId(memberId).stream()
            .map(row -> new PropertyListItemResult(row, progressByProperty.getOrDefault(row.propertyId(), List.of())))
            .toList();
    }

    public PropertyDetailResponse findDetail(final Long memberId, final Long propertyId) {
        Property property = propertyRepository.findByIdAndMemberId(propertyId, memberId)
            .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.PROPERTY_NOT_FOUND,
                "매물을 찾을 수 없습니다."));
        return PropertyDetailResponse.from(property, propertyPhotoRepository.findByPropertyId(propertyId),
            propertyPhotoRepository.findRepresentativePhotoId(propertyId).orElse(null),
            PropertyProgress.from(propertyProgressRepository.findByPropertyId(propertyId)));
    }

    @Transactional
    public Property create(final Long memberId, final CreatePropertyRequest request) {
        memberRepository.findByIdForUpdate(memberId)
            .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.MEMBER_NOT_FOUND, "회원을 찾을 수 없습니다."));

        int propertyCount = propertyRepository.countByMemberId(memberId);
        validatePropertyCount(propertyCount);

        LocalDateTime now = LocalDateTime.now(clock);
        Property property = propertyRepository.save(Property.create(
            memberId, request.name(), request.depositAmount(), request.monthlyRentAmount(),
            request.address(), request.latitude(), request.longitude(),
            request.availableMoveInDate(), request.maintenanceFeeAmount(), request.visitScheduledAt(),
            request.roomOptions(), request.utilityOptions(), request.discoverySource(), now));

        // 매물 생성 트랜잭션 내에서 2단계 체크리스트 스냅샷 자동 생성
        propertyChecklistService.applyInitialChecklists(memberId, property.getId());

        return property;
    }

    private void validatePropertyCount(final int propertyCount) {
        if (propertyCount >= 30) {
            throw new BusinessRuleViolationException(ErrorCode.PROPERTY_LIMIT_EXCEEDED,
                "회원당 매물은 30개까지 등록할 수 있습니다.");
        }
    }

    @Transactional
    public Property update(final Long memberId, final Long propertyId, final UpdatePropertyRequest request) {
        Property property = propertyRepository.findByIdAndMemberIdForUpdate(propertyId, memberId)
            .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.PROPERTY_NOT_FOUND,
                "매물을 찾을 수 없습니다."));
        property.replaceBasicInfo(request.name(), request.depositAmount(),
            request.monthlyRentAmount(), request.address(),
            request.latitude(), request.longitude(),
            request.availableMoveInDate(), request.maintenanceFeeAmount(), request.visitScheduledAt(),
            request.roomOptions(), request.utilityOptions(), request.discoverySource(), LocalDateTime.now(clock));
        return propertyRepository.update(property);
    }

    // 추출하지 못한 값(null)과 추출 대상이 아닌 값은 기존 값을 유지하고, 메모는 기존 메모 뒤에 덧붙인다.
    // 기본 정보·부가 정보·메모를 한 트랜잭션에서 저장한다.
    @Transactional
    public Property applyAiExtraction(final Long memberId, final Long propertyId,
                                      final PropertyExtraction extraction) {
        Property property = propertyRepository.findByIdAndMemberIdForUpdate(propertyId, memberId)
            .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.PROPERTY_NOT_FOUND,
                "매물을 찾을 수 없습니다."));
        property.replaceBasicInfo(property.getName(),
            valueOrCurrent(extraction.depositAmount(), property.getDepositAmount()),
            valueOrCurrent(extraction.monthlyRentAmount(), property.getMonthlyRentAmount()),
            property.getAddress(), property.getLatitude(), property.getLongitude(),
            valueOrCurrent(extraction.availableMoveInDate(), property.getAvailableMoveInDate()),
            valueOrCurrent(extraction.maintenanceFeeAmount(), property.getMaintenanceFeeAmount()),
            property.getVisitScheduledAt(),
            optionCodes(valueOrCurrent(extraction.roomOptions(), property.getRoomOptions())),
            optionCodes(valueOrCurrent(extraction.utilityOptions(), property.getUtilityOptions())),
            property.getDiscoverySource(), LocalDateTime.now(clock));
        property.replaceMemo(appendMemo(property.getMemo(), extraction.freeMemo()));
        propertyRepository.update(property);
        propertyRepository.updateMemo(property);
        return property;
    }

    private static <T> T valueOrCurrent(final T extracted, final T current) {
        if (extracted == null) {
            return current;
        }
        return extracted;
    }

    private static List<String> optionCodes(final Set<? extends Enum<?>> options) {
        return options.stream().map(Enum::name).toList();
    }

    // 덧붙인 메모가 자유 메모 길이 제한을 넘으면 분석 결과 전체를 버리지 않도록 추출 메모를 잘라 넣는다.
    private static String appendMemo(final String currentMemo, final String extractedMemo) {
        if (extractedMemo == null) {
            return currentMemo;
        }
        String separator = currentMemo.isEmpty() ? "" : "\n\n";
        int room = MAX_MEMO_LENGTH - currentMemo.length() - separator.length();
        if (room <= 0) {
            return currentMemo;
        }
        return currentMemo + separator + extractedMemo.substring(0, Math.min(room, extractedMemo.length()));
    }

    public String findMemoByMemberIdAndPropertyId(final Long memberId, final Long propertyId) {
        return findOwnedProperty(memberId, propertyId).getMemo();
    }

    @Transactional
    public String updateMemoByMemberIdAndPropertyId(final Long memberId, final Long propertyId,
                                                    final UpdatePropertyMemoRequest request) {
        Property property = findOwnedProperty(memberId, propertyId);
        property.replaceMemo(request.freeMemo());
        propertyRepository.updateMemo(property);
        return property.getMemo();
    }

    private Property findOwnedProperty(final Long memberId, final Long propertyId) {
        return propertyRepository.findByIdAndMemberId(propertyId, memberId)
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.PROPERTY_NOT_FOUND,
                        "매물을 찾을 수 없습니다."));
    }
}
