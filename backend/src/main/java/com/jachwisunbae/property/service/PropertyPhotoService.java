package com.jachwisunbae.property.service;

import com.jachwisunbae.common.exception.client.BusinessRuleViolationException;
import com.jachwisunbae.common.exception.client.ResourceNotFoundException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.InternalSystemException;
import com.jachwisunbae.property.entity.photo.PropertyPhoto;
import com.jachwisunbae.property.repository.PropertyPhotoRepository;
import com.jachwisunbae.property.repository.PropertyRepository;
import com.jachwisunbae.property.repository.query.PropertyPhotosQuery;
import com.jachwisunbae.property.service.dto.result.PropertyPhotoUploadResult;
import com.jachwisunbae.property.storage.PhotoContent;
import com.jachwisunbae.property.entity.photo.PhotoFile;
import com.jachwisunbae.property.storage.PhotoStorage;
import com.jachwisunbae.property.storage.PhotoStream;
import com.jachwisunbae.property.storage.PhotoStorageKeyGenerator;
import java.io.IOException;
import java.time.Clock;
import java.time.LocalDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PropertyPhotoService {
    private final PropertyRepository propertyRepository;
    private final PropertyPhotoRepository propertyPhotoRepository;
    private final PhotoStorage photoStorage;
    private final PhotoStorageKeyGenerator storageKeyGenerator;
    private final PhotoThumbnailGenerator thumbnailGenerator;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    public PropertyPhotoService(final PropertyRepository propertyRepository,
                                final PropertyPhotoRepository propertyPhotoRepository,
                                final PhotoStorage photoStorage,
                                final PhotoStorageKeyGenerator storageKeyGenerator,
                                final PhotoThumbnailGenerator thumbnailGenerator,
                                final TransactionTemplate transactionTemplate,
                                final Clock clock) {
        this.propertyRepository = propertyRepository;
        this.propertyPhotoRepository = propertyPhotoRepository;
        this.photoStorage = photoStorage;
        this.storageKeyGenerator = storageKeyGenerator;
        this.thumbnailGenerator = thumbnailGenerator;
        this.transactionTemplate = transactionTemplate;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public PropertyPhotosQuery find(final Long memberId, final Long propertyId) {
        findOwnedProperty(memberId, propertyId);
        return new PropertyPhotosQuery(propertyId, propertyPhotoRepository.findByPropertyId(propertyId),
            propertyPhotoRepository.findRepresentativePhotoId(propertyId).orElse(null));
    }

    // 파일 검증과 썸네일 생성은 CPU만 쓰므로 트랜잭션 밖에서 먼저 끝낸다.
    // 트랜잭션 안에서 하면 사진을 디코딩·축소하는 동안 DB 커넥션과 매물 락을 잡고 있게 된다.
    // 남의 매물이면 썸네일을 만들기 전에 거절하고, 소유자와 사진 수는 락을 잡은 뒤 다시 확인한다.
    public PropertyPhotoUploadResult upload(final Long memberId, final Long propertyId, final MultipartFile file) {
        findOwnedProperty(memberId, propertyId);
        PhotoFile photoFile = loadPhotoFile(file);
        byte[] thumbnail = thumbnailGenerator.generate(photoFile.bytes()).orElse(null);
        return transactionTemplate.execute(status -> store(memberId, propertyId, photoFile, thumbnail));
    }

    // 트랜잭션을 걸지 않는다. 걸면 S3에서 사진을 받는 동안에도 DB 커넥션을 잡고 있게 된다.
    // NOT_SUPPORTED도 트랜잭션 동기화 범위를 열어 처음 얻은 커넥션을 메서드가 끝날 때까지 묶어 두므로 쓰지 않는다.
    // 소유자·사진 조회는 각각 커넥션을 짧게 쓰고 반납한다. 조회 전용이라 두 조회를 한 트랜잭션으로 묶을 필요가 없다.
    // 사진 바이트 전체가 필요한 곳(비교 PDF)에서만 쓴다. 응답으로 보낼 때는 openContent를 쓴다.
    public PhotoContent findContent(final Long memberId, final Long propertyId, final Long photoId) {
        findOwnedProperty(memberId, propertyId);
        PropertyPhoto photo = findPhoto(propertyId, photoId);
        return new PhotoContent(photoStorage.download(photo.getStorageKey()), photo.getContentType());
    }

    // 사진 원본을 메모리에 올리지 않고 S3 스트림 그대로 돌려준다. 트랜잭션을 걸지 않는 이유는 findContent와 같다.
    // 반환한 스트림은 호출한 쪽이 응답으로 흘려보낸 뒤 닫는다.
    public PhotoStream openContent(final Long memberId, final Long propertyId, final Long photoId) {
        findOwnedProperty(memberId, propertyId);
        PropertyPhoto photo = findPhoto(propertyId, photoId);
        return photoStorage.openStream(photo.getStorageKey()).withContentType(photo.getContentType());
    }

    // 목록 카드와 지도 마커용. 썸네일이 없는 사진(HEIC, 썸네일 도입 전 사진)은 원본을 대신 돌려준다.
    // 트랜잭션을 걸지 않는 이유와 스트림을 닫는 책임은 openContent와 같다.
    public PhotoStream openThumbnail(final Long memberId, final Long propertyId, final Long photoId) {
        findOwnedProperty(memberId, propertyId);
        PropertyPhoto photo = findPhoto(propertyId, photoId);
        if (!photo.hasThumbnail()) {
            return photoStorage.openStream(photo.getStorageKey()).withContentType(photo.getContentType());
        }
        return photoStorage.openStream(photo.getThumbnailStorageKey())
            .withContentType(PhotoThumbnailGenerator.CONTENT_TYPE);
    }

    @Transactional
    public void delete(final Long memberId, final Long propertyId, final Long photoId) {
        lockOwnedProperty(memberId, propertyId);
        PropertyPhoto photo = findPhoto(propertyId, photoId);
        photoStorage.delete(photo.getStorageKey());
        if (photo.hasThumbnail()) {
            photoStorage.delete(photo.getThumbnailStorageKey());
        }
        propertyPhotoRepository.deleteById(photoId);
        propertyPhotoRepository.ensureRepresentative(propertyId);
    }

    @Transactional
    public void designateRepresentative(final Long memberId, final Long propertyId, final Long photoId) {
        lockOwnedProperty(memberId, propertyId);
        propertyPhotoRepository.findByIdAndPropertyId(photoId, propertyId)
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.PHOTO_NOT_FOUND,
                        "사진을 찾을 수 없습니다."));
        propertyPhotoRepository.setRepresentative(propertyId, photoId);
    }

    private PropertyPhotoUploadResult store(final Long memberId, final Long propertyId, final PhotoFile photoFile,
                                            final byte[] thumbnail) {
        lockOwnedProperty(memberId, propertyId);
        validatePhotoLimit(propertyId);

        String storageKey = storageKeyGenerator.generate(memberId, propertyId, photoFile);
        // 썸네일을 만들지 못했으면(null) 원본만 저장하고, 조회할 때 원본으로 대신한다.
        String thumbnailKey = thumbnail == null ? null : storageKeyGenerator.thumbnailKeyOf(storageKey);
        photoStorage.upload(storageKey, photoFile.bytes(), photoFile.getContentType());
        try {
            if (thumbnailKey != null) {
                photoStorage.upload(thumbnailKey, thumbnail, PhotoThumbnailGenerator.CONTENT_TYPE);
            }
            PropertyPhoto saved = propertyPhotoRepository.save(memberId,
                    PropertyPhoto.create(propertyId, storageKey, thumbnailKey, photoFile.getContentType(),
                            photoFile.size(), LocalDateTime.now(clock)));

            propertyPhotoRepository.ensureRepresentative(propertyId);
            boolean representative = propertyPhotoRepository.findRepresentativePhotoId(propertyId)
                    .map(saved.getId()::equals)
                    .orElse(false);

            return new PropertyPhotoUploadResult(saved, representative);
        } catch (RuntimeException exception) {
            deleteQuietly(storageKey, exception);
            if (thumbnailKey != null) {
                deleteQuietly(thumbnailKey, exception);
            }
            throw exception;
        }
    }

    private void deleteQuietly(final String storageKey, final RuntimeException cause) {
        try {
            photoStorage.delete(storageKey);
        } catch (RuntimeException compensationFailure) {
            cause.addSuppressed(compensationFailure);
        }
    }

    private void lockOwnedProperty(final Long memberId, final Long propertyId) {
        propertyRepository.findByIdAndMemberIdForUpdate(propertyId, memberId)
            .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.PROPERTY_NOT_FOUND,
                "매물을 찾을 수 없습니다."));
    }

    private void validatePhotoLimit(final Long propertyId) {
        if (propertyPhotoRepository.countByPropertyId(propertyId) >= 30) {
            throw new BusinessRuleViolationException(ErrorCode.PHOTO_LIMIT_EXCEEDED,
                "매물당 사진은 30장까지 업로드할 수 있습니다.");
        }
    }

    private PhotoFile loadPhotoFile(final MultipartFile file) {
        try {
            return new PhotoFile(file.getBytes(), file.getContentType());
        } catch (IOException exception) {
            // Spring이 Controller 전에 받아 둔 업로드(메모리·임시 파일)를 읽다가 실패한 것이다.
            // 업로드 중단 같은 사용자 쪽 문제는 그 전에 다른 예외로 실패하므로 서버 문제로 본다.
            throw new InternalSystemException(ErrorCode.PHOTO_FILE_READ_FAILURE,
                "업로드 사진을 읽을 수 없습니다.", exception);
        }
    }

    private void findOwnedProperty(final Long memberId, final Long propertyId) {
        if (!propertyRepository.existsByIdAndMemberId(propertyId, memberId)) {
            throw new ResourceNotFoundException(ErrorCode.PROPERTY_NOT_FOUND, "매물을 찾을 수 없습니다.");
        }
    }

    private PropertyPhoto findPhoto(final Long propertyId, final Long photoId) {
        return propertyPhotoRepository.findByIdAndPropertyId(photoId, propertyId)
            .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.PHOTO_NOT_FOUND,
                "사진을 찾을 수 없습니다."));
    }

}
