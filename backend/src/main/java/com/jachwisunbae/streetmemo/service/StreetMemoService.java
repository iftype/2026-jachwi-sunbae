package com.jachwisunbae.streetmemo.service;

import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.client.ResourceNotFoundException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.member.service.MemberService;
import com.jachwisunbae.streetmemo.domain.StreetMemo;
import com.jachwisunbae.streetmemo.domain.StreetMemoPreference;
import com.jachwisunbae.streetmemo.repository.StreetMemoRepository;
import com.jachwisunbae.streetmemo.service.dto.result.StreetMemoResult;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class StreetMemoService {

    private final StreetMemoRepository streetMemoRepository;
    private final MemberService memberService;
    private final Clock clock;

    public StreetMemoService(final StreetMemoRepository streetMemoRepository, final MemberService memberService,
                             final Clock clock) {
        this.streetMemoRepository = streetMemoRepository;
        this.memberService = memberService;
        this.clock = clock;
    }

    @Transactional
    public StreetMemoResult create(final Long memberId, final BigDecimal latitude, final BigDecimal longitude,
                                    final String memo, final StreetMemoPreference preference) {
        StreetMemo streetMemo = StreetMemo.create(memberId, latitude, longitude, memo, preference,
                LocalDateTime.now(clock));
        memberService.findById(memberId);
        return StreetMemoResult.from(streetMemoRepository.save(streetMemo), memberId);
    }

    public List<StreetMemoResult> findAllWithin(final Long memberId,
                                               final BigDecimal minLatitude, final BigDecimal maxLatitude,
                                               final BigDecimal minLongitude, final BigDecimal maxLongitude) {
        validateBounds(minLatitude, maxLatitude, minLongitude, maxLongitude);
        return streetMemoRepository.findAllWithin(minLatitude, maxLatitude, minLongitude, maxLongitude)
                .stream().map(streetMemo -> StreetMemoResult.from(streetMemo, memberId)).toList();
    }

    @Transactional
    public void delete(final Long memberId, final long streetMemoId) {
        memberService.findById(memberId);
        StreetMemo streetMemo = streetMemoRepository.findByIdForUpdate(streetMemoId)
                .orElseThrow(this::notFound);
        streetMemo.delete(memberId, LocalDateTime.now(clock));
        if (streetMemoRepository.delete(streetMemo) != 1) {
            throw notFound();
        }
    }

    private void validateBounds(final BigDecimal minLatitude, final BigDecimal maxLatitude,
                                final BigDecimal minLongitude, final BigDecimal maxLongitude) {
        if (minLatitude == null || maxLatitude == null || minLongitude == null || maxLongitude == null
                || minLatitude.compareTo(maxLatitude) > 0 || minLongitude.compareTo(maxLongitude) > 0
                || minLatitude.compareTo(BigDecimal.valueOf(-90)) < 0
                || maxLatitude.compareTo(BigDecimal.valueOf(90)) > 0
                || minLongitude.compareTo(BigDecimal.valueOf(-180)) < 0
                || maxLongitude.compareTo(BigDecimal.valueOf(180)) > 0) {
            throw new InvalidInputException(ErrorCode.STREET_MEMO_QUERY_INVALID,
                    "조회 영역의 좌표는 허용 범위 안에 있어야 하며 최솟값은 최댓값 이하여야 합니다.");
        }
    }

    private ResourceNotFoundException notFound() {
        return new ResourceNotFoundException(ErrorCode.STREET_MEMO_NOT_FOUND, "거리 메모를 찾을 수 없습니다.");
    }
}
