package com.jachwisunbae.guest.controller.dto.response;

import com.jachwisunbae.checklist.controller.dto.response.UserChecklistListResponse;
import com.jachwisunbae.checklist.controller.dto.response.UserChecklistSummaryResponse;
import com.jachwisunbae.checklist.type.CheckStage;
import com.jachwisunbae.property.controller.dto.response.PropertyChecklistStageResponse;
import com.jachwisunbae.property.controller.dto.response.PropertyListItemResponse;
import com.jachwisunbae.property.controller.dto.response.PropertyListResponse;
import com.jachwisunbae.property.controller.dto.response.PropertyProgress;
import java.math.BigDecimal;
import java.util.List;

public final class GuestSampleResponses {

    private GuestSampleResponses() {
    }

    public static PropertyListResponse properties() {
        PropertyProgress firstProgress = new PropertyProgress(10, 7, 5, 2, 3, 70);
        PropertyProgress secondProgress = new PropertyProgress(10, 3, 2, 1, 7, 30);

        List<PropertyListItemResponse> items = List.of(
                new PropertyListItemResponse(
                        1L,
                        "학교 앞 원룸",
                        10_000_000L,
                        550_000L,
                        "부동산 앱",
                        "서울특별시 성북구 안암로 145",
                        new BigDecimal("37.5882"),
                        new BigDecimal("127.0338"),
                        0,
                        null,
                        firstProgress,
                        sampleStages(1L, firstProgress)
                ),
                new PropertyListItemResponse(
                        2L,
                        "역세권 투룸",
                        20_000_000L,
                        700_000L,
                        "공인중개사",
                        "서울특별시 동대문구 왕산로 200",
                        new BigDecimal("37.5802"),
                        new BigDecimal("127.0474"),
                        0,
                        null,
                        secondProgress,
                        sampleStages(2L, secondProgress)
                )
        );
        return new PropertyListResponse(items.size(), items);
    }

    private static List<PropertyChecklistStageResponse> sampleStages(
            final long propertyId,
            final PropertyProgress progress
    ) {
        long checklistId = propertyId * 10;
        return List.of(
                new PropertyChecklistStageResponse(
                        CheckStage.ON_SITE,
                        true,
                        checklistId + 1,
                        "현장 방문 기본 체크리스트",
                        1L,
                        progress
                ),
                new PropertyChecklistStageResponse(
                        CheckStage.PRE_CONTRACT,
                        true,
                        checklistId + 2,
                        "계약 전 기본 체크리스트",
                        2L,
                        progress
                )
        );
    }

    public static UserChecklistListResponse checklists() {
        List<UserChecklistSummaryResponse> items = List.of(
                new UserChecklistSummaryResponse(1L, "현장 방문 기본 체크리스트", CheckStage.ON_SITE, 10),
                new UserChecklistSummaryResponse(2L, "계약 전 기본 체크리스트", CheckStage.PRE_CONTRACT, 10)
        );
        return new UserChecklistListResponse(items.size(), items);
    }
}
