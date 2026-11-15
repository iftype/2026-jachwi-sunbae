package com.jachwisunbae.property.storage;

import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.common.exception.server.UpstreamServiceException;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import org.springframework.stereotype.Component;

@Component
public class S3PhotoStorage implements PhotoStorage {

    private final S3Client s3Client;
    private final String bucket;

    public S3PhotoStorage(final S3Client s3Client, final PhotoStorageProperties properties) {
        this.s3Client = s3Client;
        this.bucket = properties.bucket();
    }

    @Override
    public void upload(String key, byte[] bytes, String contentType) {
        try {
            s3Client.putObject(PutObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .contentType(contentType)
                    .contentLength((long) bytes.length)
                    .build(), RequestBody.fromBytes(bytes));
        } catch (SdkException exception) {
            throw storageFailure(exception);
        }
    }

    @Override
    public byte[] download(String key) {
        try {
            return s3Client.getObjectAsBytes(GetObjectRequest.builder().bucket(bucket).key(key).build()).asByteArray();
        } catch (SdkException exception) {
            throw storageFailure(exception);
        }
    }

    // 응답 본문을 읽지 않은 채 스트림으로 돌려준다. 받는 쪽이 끝까지 읽고 닫아야 S3 연결이 풀로 돌아간다.
    @Override
    public PhotoStream openStream(String key) {
        try {
            ResponseInputStream<GetObjectResponse> stream =
                    s3Client.getObject(GetObjectRequest.builder().bucket(bucket).key(key).build());
            GetObjectResponse response = stream.response();
            return new PhotoStream(new FailureLoggingInputStream(stream, key, response.contentLength()),
                    response.contentLength(), response.contentType());
        } catch (SdkException exception) {
            throw storageFailure(exception);
        }
    }

    @Override
    public void delete(String key) {
        try {
            s3Client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
        } catch (SdkException exception) {
            throw storageFailure(exception);
        }
    }

    // AWS SDK 예외(연결 실패, 시간 초과, S3 오류 응답)만 외부 저장소 장애로 바꾼다.
    // 우리 코드의 오류까지 저장소 장애로 숨기지 않도록 RuntimeException 전체를 잡지 않는다.
    private UpstreamServiceException storageFailure(SdkException cause) {
        return new UpstreamServiceException(ErrorCode.PHOTO_STORAGE_FAILURE,
                "사진 저장소 요청에 실패했습니다.", cause);
    }
}
