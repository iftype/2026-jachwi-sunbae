package com.jachwisunbae.map.domain.goodprice;

import com.jachwisunbae.map.domain.GeoDistance;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import lombok.Getter;

// 행정안전부 착한가격업소. 업종, 연락처, 가격은 공공데이터 원본 값 그대로 둔다.
@Getter
public class GoodPriceStore {

    private static final BigDecimal MAX_LATITUDE = BigDecimal.valueOf(90);
    private static final BigDecimal MAX_LONGITUDE = BigDecimal.valueOf(180);
    private final Long id;
    private final String province;
    private final String district;
    private final String businessType;
    private final String name;
    private final String phone;
    private final String address;
    private final BigDecimal latitude;
    private final BigDecimal longitude;
    private final List<GoodPriceMenu> menus;
    private final LocalDate sourceDate;

    private GoodPriceStore(Long id, String province, String district, String businessType, String name,
                           String phone, String address, BigDecimal latitude, BigDecimal longitude,
                           List<GoodPriceMenu> menus, LocalDate sourceDate) {
        this.id = validateRequired(id, "착한가격업소 ID는 필수입니다.");
        this.province = validateText(province, "착한가격업소 시도는 필수입니다.");
        this.district = district;
        this.businessType = validateText(businessType, "착한가격업소 업종은 필수입니다.");
        this.name = validateText(name, "착한가격업소 이름은 필수입니다.");
        this.phone = phone;
        this.address = validateText(address, "착한가격업소 주소는 필수입니다.");
        this.latitude = validateCoordinate(latitude, MAX_LATITUDE, "착한가격업소 위도가 올바르지 않습니다.");
        this.longitude = validateCoordinate(longitude, MAX_LONGITUDE, "착한가격업소 경도가 올바르지 않습니다.");
        this.menus = List.copyOf(validateRequired(menus, "착한가격업소 메뉴 목록은 필수입니다."));
        this.sourceDate = validateRequired(sourceDate, "착한가격업소 기준일은 필수입니다.");
    }

    // 업소는 적재 스크립트로 정제해 넣은 참조 데이터다. 값이 어긋나면 서버 데이터 문제다.
    // 시군, 연락처, 메뉴는 원본에 없을 수 있다.
    public static GoodPriceStore reconstruct(Long id, String province, String district, String businessType,
                                             String name, String phone, String address,
                                             BigDecimal latitude, BigDecimal longitude,
                                             List<GoodPriceMenu> menus, LocalDate sourceDate) {
        return new GoodPriceStore(id, province, district, businessType, name, phone, address,
                latitude, longitude, menus, sourceDate);
    }

    public double distanceMetersFrom(BigDecimal latitude, BigDecimal longitude) {
        return GeoDistance.meters(latitude, longitude, this.latitude, this.longitude);
    }

    private static <T> T validateRequired(T value, String message) {
        if (value == null) {
            throw new IllegalArgumentException(message);
        }
        return value;
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
