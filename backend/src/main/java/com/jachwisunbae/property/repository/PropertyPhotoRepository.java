package com.jachwisunbae.property.repository;

import com.jachwisunbae.property.entity.photo.PropertyPhoto;
import java.util.List;
import java.util.Optional;

public interface PropertyPhotoRepository {
    List<PropertyPhoto> findByPropertyId(long propertyId);

    int countByPropertyId(long propertyId);

    PropertyPhoto save(long memberId, PropertyPhoto photo);

    Optional<PropertyPhoto> findByIdAndPropertyId(long photoId, long propertyId);

    void deleteById(long photoId);

    void deleteByPropertyId(long propertyId);

    void ensureRepresentative(long propertyId);

    Optional<Long> findRepresentativePhotoId(long propertyId);

    void setRepresentative(long propertyId, long photoId);

    List<PropertyPhoto> findWithoutThumbnailAfter(long afterPhotoId, int limit);

    boolean updateThumbnailStorageKey(long photoId, String thumbnailStorageKey);
}
