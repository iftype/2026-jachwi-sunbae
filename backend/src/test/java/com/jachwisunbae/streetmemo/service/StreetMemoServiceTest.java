package com.jachwisunbae.streetmemo.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.jachwisunbae.common.exception.client.ResourceNotFoundException;
import com.jachwisunbae.member.service.MemberService;
import com.jachwisunbae.streetmemo.domain.StreetMemo;
import com.jachwisunbae.streetmemo.domain.StreetMemoPreference;
import com.jachwisunbae.streetmemo.repository.StreetMemoRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class StreetMemoServiceTest {

    @Mock
    private StreetMemoRepository repository;
    @Mock
    private MemberService memberService;

    @Test
    @DisplayName("실제 삭제된 행이 없으면 삭제 성공으로 반환하지 않는다")
    void rejectsUnappliedDeletion() {
        Clock clock = Clock.fixed(Instant.parse("2026-10-26T12:00:00Z"), ZoneOffset.UTC);
        LocalDateTime now = LocalDateTime.now(clock);
        StreetMemo memo = StreetMemo.reconstruct(10L, 1L, new BigDecimal("37.5"), new BigDecimal("127.0"),
                "동네 메모", StreetMemoPreference.LIKE, now, now, null);
        when(repository.findByIdForUpdate(10L)).thenReturn(Optional.of(memo));
        when(repository.delete(memo)).thenReturn(0);
        StreetMemoService service = new StreetMemoService(repository, memberService, clock);

        assertThatThrownBy(() -> service.delete(1L, 10L)).isInstanceOf(ResourceNotFoundException.class);
    }
}
