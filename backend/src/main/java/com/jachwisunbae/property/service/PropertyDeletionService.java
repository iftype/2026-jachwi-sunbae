package com.jachwisunbae.property.service;

import com.jachwisunbae.common.exception.client.ResourceNotFoundException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.property.repository.PropertyPhotoRepository;
import com.jachwisunbae.property.repository.PropertyRepository;
import com.jachwisunbae.property.storage.PhotoStorage;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PropertyDeletionService {
    private final PropertyRepository propertyRepository;
    private final PropertyPhotoRepository propertyPhotoRepository;
    private final PhotoStorage photoStorage;

    public PropertyDeletionService(final PropertyRepository propertyRepository,
                                   final PropertyPhotoRepository propertyPhotoRepository,
                                   final PhotoStorage photoStorage) {
        this.propertyRepository = propertyRepository;
        this.propertyPhotoRepository = propertyPhotoRepository;
        this.photoStorage = photoStorage;
    }

    @Transactional
    public void delete(final Long memberId, final Long propertyId) {
        propertyRepository.findByIdAndMemberIdForUpdate(propertyId, memberId)
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.PROPERTY_NOT_FOUND,
                        "매물을 찾을 수 없습니다."));
        propertyPhotoRepository.findByPropertyId(propertyId).forEach(photo -> {
            photoStorage.delete(photo.getStorageKey());
            if (photo.hasThumbnail()) {
                photoStorage.delete(photo.getThumbnailStorageKey());
            }
        });
        propertyRepository.deleteById(propertyId);
    }
}
