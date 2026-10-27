package com.jachwisunbae.streetmemo.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class StreetMemoTest {

    @Test
    @DisplayName("삭제 시각이 마지막 수정 시각보다 빠르면 원래 상태를 유지한다")
    void rejectsDeletionBeforeLastUpdate() {
        LocalDateTime createdAt = LocalDateTime.of(2026, 10, 26, 12, 0);
        LocalDateTime updatedAt = createdAt.plusDays(1);
        StreetMemo memo = StreetMemo.reconstruct(10L, 1L, new BigDecimal("37.5"), new BigDecimal("127.0"),
                "동네 메모", StreetMemoPreference.LIKE, createdAt, updatedAt, null);

        assertThatThrownBy(() -> memo.delete(1L, createdAt)).isInstanceOf(IllegalArgumentException.class);

        assertThat(memo.isDeleted()).isFalse();
        assertThat(memo.getUpdatedAt()).isEqualTo(updatedAt);
    }
}
