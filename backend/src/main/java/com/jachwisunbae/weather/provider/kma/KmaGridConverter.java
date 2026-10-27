package com.jachwisunbae.weather.provider.kma;

import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.weather.domain.GridPoint;
import org.springframework.stereotype.Component;

// 위경도를 기상청 단기예보 5km 격자 좌표(nx, ny)로 변환한다. 기상청이 공개한 변환 공식을 그대로 옮겼다.
@Component
public class KmaGridConverter {

    // 지구 반지름(km)을 격자 간격 5km로 나눠 격자 단위로 표현한다.
    private static final double EARTH_RADIUS_IN_GRIDS = 6371.00877 / 5.0;
    // 투영 기준: 표준위도 30°N·60°N, 기준점 38°N·126°E
    private static final double STANDARD_LATITUDE_1 = Math.toRadians(30);
    private static final double STANDARD_LATITUDE_2 = Math.toRadians(60);
    private static final double ORIGIN_LATITUDE = Math.toRadians(38);
    private static final double ORIGIN_LONGITUDE = Math.toRadians(126);
    // 아래 세 값은 투영 상수라 한 번만 계산한다. (원뿔 상수, 축척 계수, 기준점까지의 거리)
    private static final double CONE = Math.log(Math.cos(STANDARD_LATITUDE_1) / Math.cos(STANDARD_LATITUDE_2))
            / Math.log(Math.tan(Math.PI / 4 + STANDARD_LATITUDE_2 / 2)
            / Math.tan(Math.PI / 4 + STANDARD_LATITUDE_1 / 2));
    private static final double SCALE = Math.pow(Math.tan(Math.PI / 4 + STANDARD_LATITUDE_1 / 2), CONE)
            * Math.cos(STANDARD_LATITUDE_1) / CONE;
    private static final double ORIGIN_RADIUS = radius(ORIGIN_LATITUDE);

    // 기상청 동네예보 Lambert conformal conic 투영. 기준점 (38N, 126E)은 (43, 136)이다.
    public GridPoint convert(final double latitude, final double longitude) {
        if (!Double.isFinite(latitude) || !Double.isFinite(longitude)
                || latitude <= -90 || latitude >= 90 || longitude < -180 || longitude > 180) {
            throw new InvalidInputException(ErrorCode.WEATHER_COORDINATE_INVALID, "위경도 형식·범위가 유효하지 않습니다.");
        }
        // 기준 경도와의 차이를 -π~π 범위로 맞춘다.
        double angle = Math.toRadians(longitude) - ORIGIN_LONGITUDE;
        if (angle > Math.PI) {
            angle -= 2 * Math.PI;
        }
        if (angle < -Math.PI) {
            angle += 2 * Math.PI;
        }
        // 투영 평면 좌표를 구해 기준점 격자 (43, 136)만큼 옮기고, +0.5 후 내림으로 반올림한다.
        double radius = radius(Math.toRadians(latitude));
        double x = Math.floor(radius * Math.sin(angle * CONE) + 43 + 0.5);
        double y = Math.floor(ORIGIN_RADIUS - radius * Math.cos(angle * CONE) + 136 + 0.5);
        // 위경도는 유효하지만 기상청 격자(149×253) 밖이면 지원하지 않는 지역이다.
        if (!Double.isFinite(x) || !Double.isFinite(y)
                || x < 1 || x > GridPoint.WIDTH || y < 1 || y > GridPoint.HEIGHT) {
            throw new InvalidInputException(ErrorCode.WEATHER_LOCATION_UNSUPPORTED, "기상청 격자 지원 범위 밖입니다.");
        }
        return new GridPoint((int) x, (int) y);
    }

    // 투영 원뿔의 꼭짓점에서 해당 위도까지의 거리(격자 단위)
    private static double radius(final double latitude) {
        return EARTH_RADIUS_IN_GRIDS * SCALE / Math.pow(Math.tan(Math.PI / 4 + latitude / 2), CONE);
    }
}
