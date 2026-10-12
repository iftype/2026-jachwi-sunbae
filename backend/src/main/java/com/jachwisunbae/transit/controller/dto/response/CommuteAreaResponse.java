package com.jachwisunbae.transit.controller.dto.response;

import com.fasterxml.jackson.annotation.JsonRawValue;
import com.jachwisunbae.transit.domain.AdminDong;
import com.jachwisunbae.transit.domain.CommuteArea;
import com.jachwisunbae.transit.domain.vo.Coordinate;
import java.util.List;

// boundary는 저장해 둔 GeoJSON geometry 문자열을 다시 파싱하지 않고 JSON 객체로 그대로 내보낸다.
public record CommuteAreaResponse(String adminDongCode, String name, String fullName, int commuteMinutes,
                                  Center center, @JsonRawValue String boundary,
                                  List<CommuteStationResponse> stations) {

    public static CommuteAreaResponse from(final CommuteArea area) {
        AdminDong adminDong = area.adminDong();
        Coordinate center = adminDong.center();
        return new CommuteAreaResponse(adminDong.code(), adminDong.name(), adminDong.fullName(),
                area.commuteMinutes(), new Center(center.latitude(), center.longitude()),
                adminDong.boundary().geoJson(),
                area.stations().stream().map(CommuteStationResponse::from).toList());
    }

    public record Center(double latitude, double longitude) {
    }
}
