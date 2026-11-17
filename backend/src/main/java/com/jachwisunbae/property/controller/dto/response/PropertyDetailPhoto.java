package com.jachwisunbae.property.controller.dto.response;

import com.jachwisunbae.property.entity.photo.PropertyPhoto;

import java.time.Instant;
import java.time.ZoneOffset;

public record PropertyDetailPhoto(Long id, String url, String thumbnailUrl, String contentType, Long sizeBytes,
                                  boolean representative, Instant createdAt) {
    public static PropertyDetailPhoto from(final PropertyPhoto photo, final boolean representative) {
        String url = PropertyPhotoUrls.content(photo.getPropertyId(), photo.getId());
        return new PropertyDetailPhoto(photo.getId(), url, PropertyPhotoUrls.thumbnailOf(url), photo.getContentType(),
                photo.getSizeBytes(), representative, photo.getCreatedAt().toInstant(ZoneOffset.UTC));
    }
}
