package com.jachwisunbae.map.service.cctv;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.map.domain.CoordinateBounds;
import com.jachwisunbae.map.domain.GeoDistance;
import com.jachwisunbae.map.domain.cctv.Cctv;
import com.jachwisunbae.map.domain.cctv.CctvPurpose;
import com.jachwisunbae.map.service.dto.result.cctv.CctvResult;
import com.jachwisunbae.map.service.dto.result.cctv.CctvsResult;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CctvServiceTest {

    private static final BigDecimal LATITUDE = new BigDecimal("37.3940000");
    private static final BigDecimal LONGITUDE = new BigDecimal("127.1090000");

    @Test
    @DisplayName("요청 반경을 감싸는 사각형으로 후보를 조회한다")
    void requestsCandidatesWithinBounds() {
        List<CoordinateBounds> requested = new ArrayList<>();
        CctvService service = new CctvService((bounds, purposes) -> {
            requested.add(bounds);
            return List.of();
        });

        service.nearby(LATITUDE, LONGITUDE, 1000, null);

        assertThat(requested).singleElement().usingRecursiveComparison()
                .isEqualTo(CoordinateBounds.around(LATITUDE, LONGITUDE, 1000));
    }

    @Test
    @DisplayName("설치목적을 지정하지 않으면 전체 설치목적으로 조회한다")
    void requestsAllPurposesByDefault() {
        List<Set<CctvPurpose>> requested = new ArrayList<>();
        CctvService service = new CctvService((bounds, purposes) -> {
            requested.add(purposes);
            return List.of();
        });

        service.nearby(LATITUDE, LONGITUDE, 500, null);
        service.nearby(LATITUDE, LONGITUDE, 500, List.of());

        assertThat(requested).containsExactly(EnumSet.allOf(CctvPurpose.class), EnumSet.allOf(CctvPurpose.class));
    }

    @Test
    @DisplayName("요청한 설치목적 코드로 조회하고 중복 코드는 한 번만 넘긴다")
    void requestsGivenPurposes() {
        List<Set<CctvPurpose>> requested = new ArrayList<>();
        CctvService service = new CctvService((bounds, purposes) -> {
            requested.add(purposes);
            return List.of();
        });

        service.nearby(LATITUDE, LONGITUDE, 500, List.of("CRIME_PREVENTION", "CHILD_PROTECTION", "CRIME_PREVENTION"));

        assertThat(requested).containsExactly(EnumSet.of(CctvPurpose.CRIME_PREVENTION, CctvPurpose.CHILD_PROTECTION));
    }

    @Test
    @DisplayName("사각형 모서리에 있지만 실제 반경 밖인 CCTV는 제외한다")
    void excludesCctvsOutsideRadius() {
        CoordinateBounds bounds = CoordinateBounds.around(LATITUDE, LONGITUDE, 500);
        Cctv inside = cctv(1L, "37.3950000", "127.1090000");
        Cctv corner = cctv(2L, bounds.getMaxLatitude().toPlainString(), bounds.getMaxLongitude().toPlainString());
        CctvService service = new CctvService((ignored, purposes) -> List.of(inside, corner));

        CctvsResult result = service.nearby(LATITUDE, LONGITUDE, 500, null);

        assertThat(result.cctvs()).extracting(CctvResult::cctv).containsExactly(inside);
    }

    @Test
    @DisplayName("가까운 순으로 정렬하고 거리가 같으면 ID 순으로 정렬한다")
    void sortsByDistance() {
        Cctv far = cctv(1L, "37.3980000", "127.1090000");
        Cctv nearSecond = cctv(3L, "37.3950000", "127.1090000");
        Cctv nearFirst = cctv(2L, "37.3950000", "127.1090000");
        CctvService service = new CctvService((ignored, purposes) -> List.of(far, nearSecond, nearFirst));

        CctvsResult result = service.nearby(LATITUDE, LONGITUDE, 1000, null);

        assertThat(result.cctvs()).extracting(cctvResult -> cctvResult.cctv().getId())
                .containsExactly(2L, 3L, 1L);
    }

    @Test
    @DisplayName("반경 안의 CCTV를 같은 좌표여도 합치지 않고 개수 제한 없이 모두 반환한다")
    void returnsAllCctvsWithinRadius() {
        List<Cctv> cctvs = new ArrayList<>();
        for (long id = 1; id <= 3000; id++) {
            cctvs.add(cctv(id, "37.3940000", "127.1090000"));
        }
        CctvService service = new CctvService((ignored, purposes) -> cctvs);

        assertThat(service.nearby(LATITUDE, LONGITUDE, 500, null).cctvs()).hasSize(3000);
    }

    @Test
    @DisplayName("거리는 GeoDistance로 계산해 미터 단위 정수로 반올림한다")
    void calculatesDistanceWithGeoDistance() {
        Cctv cctv = cctv(1L, "37.3950000", "127.1100000");
        CctvService service = new CctvService((ignored, purposes) -> List.of(cctv));

        CctvsResult result = service.nearby(LATITUDE, LONGITUDE, 500, null);

        long expected = Math.round(GeoDistance.meters(LATITUDE, LONGITUDE, cctv.getLatitude(), cctv.getLongitude()));
        assertThat(result.cctvs()).singleElement()
                .extracting(CctvResult::distanceMeters)
                .isEqualTo((int) expected);
    }

    @Test
    @DisplayName("요청 조건을 함께 반환한다")
    void returnsQuery() {
        CctvService service = new CctvService((ignored, purposes) -> List.of());

        CctvsResult result = service.nearby(LATITUDE, LONGITUDE, 2000, null);

        assertThat(result.latitude()).isEqualTo(LATITUDE);
        assertThat(result.longitude()).isEqualTo(LONGITUDE);
        assertThat(result.radius()).isEqualTo(2000);
    }

    @Test
    @DisplayName("반경 안에 CCTV가 없으면 빈 목록을 반환한다")
    void returnsEmptyResult() {
        CctvService service = new CctvService((ignored, purposes) -> List.of());

        assertThat(service.nearby(LATITUDE, LONGITUDE, 500, null).cctvs()).isEmpty();
    }

    @Test
    @DisplayName("좌표, 반경, 설치목적이 허용 범위를 벗어나면 사용자 입력 오류로 본다")
    void rejectsInvalidQuery() {
        CctvService service = new CctvService((ignored, purposes) -> List.of());

        assertInvalidQuery(() -> service.nearby(null, LONGITUDE, 500, null));
        assertInvalidQuery(() -> service.nearby(LATITUDE, null, 500, null));
        assertInvalidQuery(() -> service.nearby(new BigDecimal("90.1"), LONGITUDE, 500, null));
        assertInvalidQuery(() -> service.nearby(LATITUDE, new BigDecimal("-180.1"), 500, null));
        assertInvalidQuery(() -> service.nearby(LATITUDE, LONGITUDE, 700, null));
        assertInvalidQuery(() -> service.nearby(LATITUDE, LONGITUDE, 500, List.of("CRIME_PREVENTION", "UNKNOWN")));
        assertInvalidQuery(() -> service.nearby(LATITUDE, LONGITUDE, 500, List.of("생활방범")));
        assertInvalidQuery(() -> service.nearby(LATITUDE, LONGITUDE, 500, List.of("crime_prevention")));
    }

    private static void assertInvalidQuery(ThrowingCallable call) {
        assertThatThrownBy(call)
                .isInstanceOfSatisfying(InvalidInputException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.MAP_QUERY_INVALID));
    }

    private static Cctv cctv(Long id, String latitude, String longitude) {
        return Cctv.reconstruct(id, "관리번호" + id, "경기도 성남시 분당구 판교역로 166", CctvPurpose.CRIME_PREVENTION, 1,
                200, 30, new BigDecimal(latitude), new BigDecimal(longitude));
    }
}
