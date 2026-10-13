package com.jachwisunbae.transit.controller.dto.response;

import com.jachwisunbae.transit.domain.CommuteArea;
import java.util.List;

// 행정동 이름과 경계는 클라이언트가 가진 행정동 데이터에서 코드로 찾는다.
public record CommuteAreaResponse(String adminDongCode, int commuteMinutes, List<CommuteStationResponse> stations) {

    public static CommuteAreaResponse from(final CommuteArea area) {
        return new CommuteAreaResponse(area.adminDongCode(), area.commuteMinutes(),
                area.stations().stream().map(CommuteStationResponse::from).toList());
    }
}
