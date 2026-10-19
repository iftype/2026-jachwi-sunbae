package com.jachwisunbae.map.domain.busstop;

import com.jachwisunbae.map.domain.GeoDistance;
import java.math.BigDecimal;
import java.util.regex.Pattern;
import lombok.Getter;

@Getter
public class BusStop {

    private static final BigDecimal MAX_LATITUDE = BigDecimal.valueOf(90);
    private static final BigDecimal MAX_LONGITUDE = BigDecimal.valueOf(180);
    private static final Pattern AGENCY_CODE = Pattern.compile("^[A-Z]{3}(?=\\d)");
    private final String nodeId;
    private final String name;
    private final BigDecimal latitude;
    private final BigDecimal longitude;
    private final String cityCode;

    private BusStop(String nodeId, String name, BigDecimal latitude, BigDecimal longitude, String cityCode) {
        this.nodeId = nodeId;
        this.name = name;
        this.latitude = latitude;
        this.longitude = longitude;
        this.cityCode = cityCode;
    }

    // 정류장은 적재 스크립트로 정제해 넣은 참조 데이터다. 값이 어긋나면 서버 데이터 문제다.
    public static BusStop reconstruct(String nodeId, String name, BigDecimal latitude, BigDecimal longitude,
                                      String cityCode) {
        return new BusStop(validateText(nodeId, "정류장 ID는 필수입니다."),
                validateText(name, "정류장 이름은 필수입니다."),
                validateCoordinate(latitude, MAX_LATITUDE, "정류장 위도가 올바르지 않습니다."),
                validateCoordinate(longitude, MAX_LONGITUDE, "정류장 경도가 올바르지 않습니다."),
                validateText(cityCode, "정류장 도시 코드는 필수입니다."));
    }

    // 정류장 ID는 관리 기관 코드(GGB 경기, SEB 서울, ICB 인천 등)와 정류소 ID로 이뤄진다.
    // 여러 기관이 같은 정류장을 각자 등록하면 기관 코드만 다르고 정류소 ID는 같다. 이름과 좌표는 기관마다 조금씩 다를 수 있다.
    public String getStationId() {
        return AGENCY_CODE.matcher(nodeId).replaceFirst("");
    }

    public double distanceMetersFrom(BigDecimal latitude, BigDecimal longitude) {
        return GeoDistance.meters(latitude, longitude, this.latitude, this.longitude);
    }

    private static String validateText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(message);
        }
        return value;
    }

    private static BigDecimal validateCoordinate(BigDecimal value, BigDecimal limit, String message) {
        if (value == null || value.abs().compareTo(limit) > 0) {
            throw new IllegalArgumentException(message);
        }
        return value;
    }
}
