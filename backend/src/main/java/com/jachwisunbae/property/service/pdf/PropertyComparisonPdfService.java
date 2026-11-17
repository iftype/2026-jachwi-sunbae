package com.jachwisunbae.property.service.pdf;

import com.jachwisunbae.checklist.type.CheckStage;
import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.client.ResourceNotFoundException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.property.controller.dto.response.PropertyChecklistOverviewResponse;
import com.jachwisunbae.property.controller.dto.response.PropertyChecklistStageResponse;
import com.jachwisunbae.property.entity.Property;
import com.jachwisunbae.property.entity.photo.PropertyPhoto;
import com.jachwisunbae.property.repository.PropertyRepository;
import com.jachwisunbae.property.repository.query.PropertyPhotosQuery;
import com.jachwisunbae.property.service.PropertyChecklistService;
import com.jachwisunbae.property.service.PropertyPhotoService;
import com.jachwisunbae.property.service.pdf.model.PropertyComparisonPhoto;
import com.jachwisunbae.property.service.pdf.model.PropertyComparisonRecord;
import com.jachwisunbae.property.service.pdf.model.PropertyComparisonStage;
import com.jachwisunbae.property.storage.PhotoContent;
import java.util.HashSet;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class PropertyComparisonPdfService {
    private static final int MIN_PROPERTIES = 1;
    private static final int MAX_PROPERTIES = 5;

    private final PropertyRepository propertyRepository;
    private final PropertyPhotoService propertyPhotoService;
    private final PropertyChecklistService propertyChecklistService;
    private final PropertyComparisonPhotoOptimizer photoOptimizer;
    private final PropertyComparisonPdfRenderer renderer;

    public PropertyComparisonPdfService(final PropertyRepository propertyRepository,
                                        final PropertyPhotoService propertyPhotoService,
                                        final PropertyChecklistService propertyChecklistService,
                                        final PropertyComparisonPhotoOptimizer photoOptimizer,
                                        final PropertyComparisonPdfRenderer renderer) {
        this.propertyRepository = propertyRepository;
        this.propertyPhotoService = propertyPhotoService;
        this.propertyChecklistService = propertyChecklistService;
        this.photoOptimizer = photoOptimizer;
        this.renderer = renderer;
    }

    public byte[] export(final Long memberId, final List<Long> propertyIds) {
        validateSelection(propertyIds);
        List<PropertyComparisonRecord> records = propertyIds.stream()
                .map(propertyId -> collect(memberId, propertyId))
                .toList();
        return renderer.render(records);
    }

    private PropertyComparisonRecord collect(final Long memberId, final Long propertyId) {
        return new PropertyComparisonRecord(
                findProperty(memberId, propertyId),
                collectPhotos(memberId, propertyId),
                collectStages(memberId, propertyId));
    }

    private Property findProperty(final Long memberId, final Long propertyId) {
        return propertyRepository.findByIdAndMemberId(propertyId, memberId)
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.PROPERTY_NOT_FOUND,
                        "비교할 매물을 찾을 수 없습니다."));
    }

    private List<PropertyComparisonPhoto> collectPhotos(final Long memberId, final Long propertyId) {
        PropertyPhotosQuery photoQuery = propertyPhotoService.find(memberId, propertyId);
        return photoQuery.photos().stream()
                .map(photo -> collectPhoto(memberId, propertyId, photoQuery.representativePhotoId(), photo))
                .toList();
    }

    private PropertyComparisonPhoto collectPhoto(final Long memberId,
                                                  final Long propertyId,
                                                  final Long representativePhotoId,
                                                  final PropertyPhoto photo) {
        PhotoContent content = propertyPhotoService.findContent(memberId, propertyId, photo.getId());
        return new PropertyComparisonPhoto(
                photo.getId(),
                photoOptimizer.optimize(content.bytes()),
                "image/jpeg",
                photo.getId().equals(representativePhotoId));
    }

    private List<PropertyComparisonStage> collectStages(final Long memberId, final Long propertyId) {
        PropertyChecklistOverviewResponse overview = PropertyChecklistOverviewResponse.from(propertyId,
                propertyChecklistService.findOverview(memberId, propertyId));
        return overview.stages().stream()
                .filter(stage -> stage.stage() == CheckStage.ON_SITE)
                .map(stage -> collectStage(memberId, propertyId, stage))
                .toList();
    }

    private PropertyComparisonStage collectStage(final Long memberId,
                                                  final Long propertyId,
                                                  final PropertyChecklistStageResponse stage) {
        return new PropertyComparisonStage(
                stage,
                stage.applied()
                        ? propertyChecklistService.findApplication(
                        memberId, propertyId, stage.propertyChecklistId())
                        : null);
    }

    private void validateSelection(final List<Long> propertyIds) {
        if (propertyIds == null || propertyIds.size() < MIN_PROPERTIES || propertyIds.size() > MAX_PROPERTIES
                || propertyIds.stream().anyMatch(id -> id == null || id <= 0)
                || new HashSet<>(propertyIds).size() != propertyIds.size()) {
            throw new InvalidInputException(ErrorCode.PROPERTY_INPUT_INVALID,
                    "PDF로 받을 서로 다른 매물을 1개 이상 5개 이하로 선택해야 합니다.");
        }
    }
}
