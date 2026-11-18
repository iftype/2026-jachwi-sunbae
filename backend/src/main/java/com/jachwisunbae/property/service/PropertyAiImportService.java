package com.jachwisunbae.property.service;

import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.client.ResourceNotFoundException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.InternalSystemException;
import com.jachwisunbae.property.ai.BedrockPropertyExtractor;
import com.jachwisunbae.property.ai.PropertyExtraction;
import com.jachwisunbae.property.ai.PropertyImage;
import com.jachwisunbae.property.entity.Property;
import com.jachwisunbae.property.entity.photo.PhotoFormat;
import com.jachwisunbae.property.repository.PropertyRepository;
import java.io.IOException;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PropertyAiImportService {

    private static final int MAX_IMAGE_COUNT = 10;
    private static final long MAX_IMAGE_SIZE_BYTES = 3L * 1024 * 1024;
    private static final Set<PhotoFormat> SUPPORTED_FORMATS = Set.of(PhotoFormat.PNG, PhotoFormat.JPEG);

    private final PropertyRepository propertyRepository;
    private final BedrockPropertyExtractor extractor;
    private final PropertyService propertyService;
    private final PropertyAiUsageLimiter usageLimiter;

    public PropertyAiImportService(final PropertyRepository propertyRepository,
                                   final BedrockPropertyExtractor extractor,
                                   final PropertyService propertyService,
                                   final PropertyAiUsageLimiter usageLimiter) {
        this.propertyRepository = propertyRepository;
        this.extractor = extractor;
        this.propertyService = propertyService;
        this.usageLimiter = usageLimiter;
    }

    // 트랜잭션을 걸지 않는다. 걸면 Bedrock 응답을 기다리는 동안(최대 60초) DB 커넥션을 잡고 있어 요청이 몰리면 커넥션 풀이 고갈되어 다른 API까지 느려진다.
    // 소유권 확인은 커넥션을 짧게 쓰고 반납하고, 저장은 PropertyService.applyAiExtraction의 트랜잭션이 맡는다.
    // 같은 클래스 안이 아니라 다른 Bean을 거쳐 호출해야 트랜잭션 프록시가 적용된다.
    public Property importFromImages(final Long memberId, final Long propertyId, final List<MultipartFile> files) {
        // 남의 매물에 대해 Bedrock을 호출하지 않도록 분석 전에 소유자를 먼저 확인한다.
        if (!propertyRepository.existsByIdAndMemberId(propertyId, memberId)) {
            throw new ResourceNotFoundException(ErrorCode.PROPERTY_NOT_FOUND, "매물을 찾을 수 없습니다.");
        }
        List<PropertyImage> images = loadImages(files);
        // 검증을 통과해 실제로 Bedrock을 호출할 요청만 센다. 호출이 실패해도 비용이 생길 수 있어 횟수를 되돌리지 않는다.
        usageLimiter.acquire(memberId);
        PropertyExtraction extraction = extractor.extract(images);
        return propertyService.applyAiExtraction(memberId, propertyId, extraction);
    }

    private List<PropertyImage> loadImages(final List<MultipartFile> files) {
        if (files == null || files.isEmpty() || files.size() > MAX_IMAGE_COUNT) {
            throw new InvalidInputException(ErrorCode.PROPERTY_AI_IMAGE_INVALID,
                    "AI 분석 이미지는 1~10장이어야 합니다.");
        }
        return files.stream()
                .map(this::loadImage)
                .toList();
    }

    private PropertyImage loadImage(final MultipartFile file) {
        if (file.isEmpty() || file.getSize() > MAX_IMAGE_SIZE_BYTES) {
            throw new InvalidInputException(ErrorCode.PROPERTY_AI_IMAGE_INVALID,
                    "AI 분석 이미지는 1바이트 이상 3MiB 이하여야 합니다.");
        }
        PhotoFormat format = PhotoFormat.from(file.getContentType());
        if (!SUPPORTED_FORMATS.contains(format)) {
            throw new InvalidInputException(ErrorCode.PHOTO_CONTENT_TYPE_UNSUPPORTED,
                    "AI 분석 이미지는 PNG 또는 JPEG여야 합니다.");
        }
        byte[] bytes = readBytes(file);
        format.validate(bytes);
        return new PropertyImage(bytes, format.contentType());
    }

    private byte[] readBytes(final MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException exception) {
            // PropertyPhotoService와 같이 Spring이 받아 둔 업로드를 읽지 못한 것은 서버 문제로 본다.
            throw new InternalSystemException(ErrorCode.PHOTO_FILE_READ_FAILURE,
                    "AI 분석 이미지를 읽을 수 없습니다.", exception);
        }
    }
}
