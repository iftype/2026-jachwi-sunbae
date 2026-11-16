package com.jachwisunbae.property.ai;

import com.jachwisunbae.property.type.RoomOption;
import com.jachwisunbae.property.type.UtilityOption;
import java.time.LocalDate;
import java.util.Set;

// 이미지에서 읽지 못한 값은 null이다. 옵션의 빈 Set은 해당 항목이 없다고 확인된 경우다.
public record PropertyExtraction(
        Long depositAmount,
        Long monthlyRentAmount,
        LocalDate availableMoveInDate,
        Long maintenanceFeeAmount,
        Set<UtilityOption> utilityOptions,
        Set<RoomOption> roomOptions,
        String freeMemo) {
}
