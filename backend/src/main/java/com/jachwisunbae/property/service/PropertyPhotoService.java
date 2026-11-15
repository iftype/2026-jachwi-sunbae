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
import com.jachwisunbae.property.storage.PhotoStorageKeyGenerator;
import java.io.IOException;
import java.time.Clock;
import java.time.LocalDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PropertyPhotoService {
    private final PropertyRepository propertyRepository;
    private final PropertyPhotoRepository propertyPhotoRepository;
    private final PhotoStorage photoStorage;
    private final PhotoStorageKeyGenerator storageKeyGenerator;
    private final Clock clock;

    public PropertyPhotoService(final PropertyRepository propertyRepository,
                                final PropertyPhotoRepository propertyPhotoRepository,
                                final PhotoStorage photoStorage,
                                final PhotoStorageKeyGenerator storageKeyGenerator,
                                final Clock clock) {
        this.propertyRepository = propertyRepository;
        this.propertyPhotoRepository = propertyPhotoRepository;
        this.photoStorage = photoStorage;
        this.storageKeyGenerator = storageKeyGenerator;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public PropertyPhotosQuery find(final Long memberId, final Long propertyId) {
        findOwnedProperty(memberId, propertyId);
        return new PropertyPhotosQuery(propertyId, propertyPhotoRepository.findByPropertyId(propertyId),
            propertyPhotoRepository.findRepresentativePhotoId(propertyId).orElse(null));
    }

    @Transactional
    public PropertyPhotoUploadResult upload(final Long memberId, final Long propertyId, final MultipartFile file) {
        lockOwnedProperty(memberId, propertyId);
        validatePhotoLimit(propertyId);

        PhotoFile photoFile = loadPhotoFile(file);

        String storageKey = storageKeyGenerator.generate(memberId, propertyId, photoFile);
        photoStorage.upload(storageKey, photoFile.bytes(), photoFile.getContentType());
        try {
            PropertyPhoto saved = propertyPhotoRepository.save(memberId,
                PropertyPhoto.create(propertyId, storageKey, photoFile.getContentType(), photoFile.size(),
                    LocalDateTime.now(clock)));

            propertyPhotoRepository.ensureRepresentative(propertyId);
            boolean representative = propertyPhotoRepository.findRepresentativePhotoId(propertyId)
                .map(saved.getId()::equals)
                .orElse(false);

            return new PropertyPhotoUploadResult(saved, representative);
        } catch (RuntimeException exception) {
            try {
                photoStorage.delete(storageKey);
            } catch (RuntimeException compensationFailure) {
                exception.addSuppressed(compensationFailure);
            }
            throw exception;
        }
    }

    // 트랜잭션을 걸지 않는다. 걸면 S3에서 사진을 받는 동안에도 DB 커넥션을 잡고 있게 된다.
    // NOT_SUPPORTED도 트랜잭션 동기화 범위를 열어 처음 얻은 커넥션을 메서드가 끝날 때까지 묶어 두므로 쓰지 않는다.
    // 소유자·사진 조회는 각각 커넥션을 짧게 쓰고 반납한다. 조회 전용이라 두 조회를 한 트랜잭션으로 묶을 필요가 없다.
    public PhotoContent findContent(final Long memberId, final Long propertyId, final Long photoId) {
        findOwnedProperty(memberId, propertyId);
        PropertyPhoto photo = findPhoto(propertyId, photoId);
        return new PhotoContent(photoStorage.download(photo.getStorageKey()), photo.getContentType());
    }

    @Transactional
    public void delete(final Long memberId, final Long propertyId, final Long photoId) {
        lockOwnedProperty(memberId, propertyId);
        PropertyPhoto photo = findPhoto(propertyId, photoId);
        photoStorage.delete(photo.getStorageKey());
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
