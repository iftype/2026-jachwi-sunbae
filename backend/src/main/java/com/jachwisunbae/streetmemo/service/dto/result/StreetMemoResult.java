package com.jachwisunbae.streetmemo.service.dto.result;

import com.jachwisunbae.streetmemo.domain.StreetMemo;
import com.jachwisunbae.streetmemo.domain.StreetMemoPreference;
import java.math.BigDecimal;

public record StreetMemoResult(Long id, BigDecimal latitude, BigDecimal longitude,
                               String memo, StreetMemoPreference preference, boolean isMine) {

    public static StreetMemoResult from(final StreetMemo streetMemo, final Long memberId) {
        return new StreetMemoResult(streetMemo.getId(), streetMemo.getLatitude(), streetMemo.getLongitude(),
                streetMemo.getMemo(), streetMemo.getPreference(), streetMemo.isOwnedBy(memberId));
    }
}
