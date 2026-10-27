package com.jachwisunbae.streetmemo.domain;

import com.jachwisunbae.common.entity.BaseTimeEntity;
import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.client.ResourceNotFoundException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Getter;

@Getter
public final class StreetMemo extends BaseTimeEntity {

    private final Long id;
    private final Long memberId;
    private final StreetMemoLocation location;
    private final String memo;
    private final StreetMemoPreference preference;
    private LocalDateTime deletedAt;

    private StreetMemo(final Long id, final Long memberId, final BigDecimal latitude,
                       final BigDecimal longitude, final String memo, final StreetMemoPreference preference,
                       final LocalDateTime createdAt, final LocalDateTime updatedAt,
                       final LocalDateTime deletedAt) {
        super(requireTime(createdAt, "작성 시각"), requireTime(updatedAt, "수정 시각"));
        validateTimestamps(createdAt, updatedAt, deletedAt);
        this.id = id;
        this.memberId = requirePositiveId(memberId, "작성자 회원 ID");
        this.location = new StreetMemoLocation(latitude, longitude);
        this.memo = requireMemo(memo);
        this.preference = requirePreference(preference);
        this.deletedAt = deletedAt;
    }

    public static StreetMemo create(final Long memberId, final BigDecimal latitude, final BigDecimal longitude,
                                    final String memo, final StreetMemoPreference preference,
                                    final LocalDateTime now) {
        return new StreetMemo(null, memberId, latitude, longitude, memo, preference, now, now, null);
    }

    public static StreetMemo reconstruct(final Long id, final Long memberId, final BigDecimal latitude,
                                         final BigDecimal longitude, final String memo,
                                         final StreetMemoPreference preference, final LocalDateTime createdAt,
                                         final LocalDateTime updatedAt, final LocalDateTime deletedAt) {
        return new StreetMemo(requirePositiveId(id, "거리 메모 ID"), memberId, latitude, longitude,
                memo, preference, createdAt, updatedAt, deletedAt);
    }

    public boolean isOwnedBy(final Long memberId) {
        return this.memberId.equals(memberId);
    }

    public BigDecimal getLatitude() {
        return location.latitude();
    }

    public BigDecimal getLongitude() {
        return location.longitude();
    }

    public boolean isDeleted() {
        return deletedAt != null;
    }

    public void delete(final Long memberId, final LocalDateTime now) {
        requirePositiveId(memberId, "삭제 요청 회원 ID");
        if (isDeleted() || !isOwnedBy(memberId)) {
            throw new ResourceNotFoundException(ErrorCode.STREET_MEMO_NOT_FOUND,
                    "작성자 본인의 삭제되지 않은 거리 메모만 삭제할 수 있습니다.");
        }
        requireTime(now, "삭제 시각");
        if (now.isBefore(getUpdatedAt())) {
            throw new IllegalArgumentException("삭제 시각은 마지막 수정 시각보다 빠를 수 없습니다.");
        }
        this.deletedAt = now;
        updateUpdatedAt(now);
    }

    private static Long requirePositiveId(final Long id, final String name) {
        if (id == null || id <= 0) {
            throw new IllegalArgumentException(name + "는 양수여야 합니다.");
        }
        return id;
    }

    private static String requireMemo(final String memo) {
        if (memo == null) {
            throw new InvalidInputException(ErrorCode.STREET_MEMO_CONTENT_INVALID,
                    "거리 메모 내용은 필수입니다.");
        }
        return memo;
    }

    private static StreetMemoPreference requirePreference(final StreetMemoPreference preference) {
        if (preference == null) {
            throw new InvalidInputException(ErrorCode.STREET_MEMO_PREFERENCE_INVALID,
                    "거리 메모 선호는 필수입니다.");
        }
        return preference;
    }

    private static LocalDateTime requireTime(final LocalDateTime time, final String name) {
        if (time == null) {
            throw new IllegalArgumentException(name + "은 필수입니다.");
        }
        return time;
    }

    private static void validateTimestamps(final LocalDateTime createdAt, final LocalDateTime updatedAt,
                                           final LocalDateTime deletedAt) {
        if (updatedAt.isBefore(createdAt)) {
            throw new IllegalArgumentException("수정 시각은 작성 시각보다 빠를 수 없습니다.");
        }
        if (deletedAt != null && deletedAt.isBefore(updatedAt)) {
            throw new IllegalArgumentException("삭제 시각은 마지막 수정 시각보다 빠를 수 없습니다.");
        }
    }
}
