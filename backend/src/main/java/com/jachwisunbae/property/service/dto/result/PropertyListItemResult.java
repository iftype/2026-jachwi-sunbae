package com.jachwisunbae.property.service.dto.result;

import com.jachwisunbae.property.repository.query.PropertyChecklistProgressQuery;
import com.jachwisunbae.property.repository.query.PropertyListItemQuery;
import java.util.List;

// 매물 목록의 한 줄과 그 매물의 단계별 체크리스트 진행이다. 응답 형식(사진 주소, 진행률 계산)은 Controller DTO가 만든다.
public record PropertyListItemResult(PropertyListItemQuery row, List<PropertyChecklistProgressQuery> progress) {

    public PropertyListItemResult {
        progress = List.copyOf(progress);
    }
}
