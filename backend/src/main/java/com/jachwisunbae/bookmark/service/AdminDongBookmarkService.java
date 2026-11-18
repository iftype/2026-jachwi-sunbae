package com.jachwisunbae.bookmark.service;

import com.jachwisunbae.bookmark.domain.AdminDongCode;
import com.jachwisunbae.bookmark.repository.AdminDongBookmarkRepository;
import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.client.ResourceNotFoundException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.member.service.MemberService;
import com.jachwisunbae.transit.service.AdminDongFinder;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class AdminDongBookmarkService {

    private final AdminDongBookmarkRepository bookmarkRepository;
    private final MemberService memberService;
    private final AdminDongFinder adminDongFinder;
    private final Clock clock;

    public AdminDongBookmarkService(final AdminDongBookmarkRepository bookmarkRepository,
                                    final MemberService memberService, final AdminDongFinder adminDongFinder,
                                    final Clock clock) {
        this.bookmarkRepository = bookmarkRepository;
        this.memberService = memberService;
        this.adminDongFinder = adminDongFinder;
        this.clock = clock;
    }

    @Transactional
    public String add(final Long memberId, final String adminDongCode) {
        AdminDongCode code = new AdminDongCode(adminDongCode);
        if (!adminDongFinder.exists(code.value())) {
            throw new InvalidInputException(ErrorCode.ADMIN_DONG_BOOKMARK_INVALID,
                    "adminDongCode=" + code.value() + " 행정동이 없습니다.");
        }
        memberService.requireActiveMemberForUpdate(memberId);
        bookmarkRepository.add(memberId, code.value(), LocalDateTime.now(clock));
        return code.value();
    }

    @Transactional
    public void remove(final Long memberId, final String adminDongCode) {
        memberService.findById(memberId);
        AdminDongCode code = new AdminDongCode(adminDongCode);
        if (bookmarkRepository.remove(memberId, code.value(), LocalDateTime.now(clock)) == 0) {
            throw new ResourceNotFoundException(ErrorCode.ADMIN_DONG_BOOKMARK_NOT_FOUND, "북마크한 동네를 찾을 수 없습니다.");
        }
    }

    public List<String> findCodes(final Long memberId) {
        return bookmarkRepository.findCodesByMemberId(memberId);
    }
}
