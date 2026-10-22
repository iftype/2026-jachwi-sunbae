package com.jachwisunbae.map.service.agency;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jachwisunbae.common.exception.client.InvalidInputException;
import com.jachwisunbae.common.exception.errorcode.ErrorCode;
import com.jachwisunbae.map.domain.agency.Agency;
import com.jachwisunbae.map.service.dto.result.agency.AgenciesResult;
import java.math.BigDecimal;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AgencyServiceTest {

    private static final BigDecimal LATITUDE = new BigDecimal("37.406");
    private static final BigDecimal LONGITUDE = new BigDecimal("127.088");

    private final Agency near = agency("kakao:1", 100);
    private final Agency far = agency("kakao:2", 400);

    @Test
    @DisplayName("공급자의 결과를 순서 그대로 요청 조건과 함께 반환한다")
    void returnsProviderResultWithQuery() {
        AgencyService service = new AgencyService((latitude, longitude, radius) -> List.of(near, far));

        AgenciesResult result = service.nearby(LATITUDE, LONGITUDE, 500);

        assertThat(result.latitude()).isEqualTo(LATITUDE);
        assertThat(result.longitude()).isEqualTo(LONGITUDE);
        assertThat(result.radius()).isEqualTo(500);
        assertThat(result.agencies()).containsExactly(near, far);
    }

    @Test
    @DisplayName("같은 조건으로 다시 조회해도 저장된 결과 없이 공급자를 매번 호출한다")
    void requestsProviderEveryTime() {
        AtomicInteger calls = new AtomicInteger();
        AgencyService service = new AgencyService((latitude, longitude, radius) -> {
            calls.incrementAndGet();
            return List.of();
        });

        service.nearby(LATITUDE, LONGITUDE, 500);
        service.nearby(LATITUDE, LONGITUDE, 500);

        assertThat(calls).hasValue(2);
    }

    @Test
    @DisplayName("좌표나 반경이 허용 범위를 벗어나면 공급자를 호출하지 않고 사용자 입력 오류로 본다")
    void rejectsInvalidQuery() {
        AtomicInteger calls = new AtomicInteger();
        AgencyService service = new AgencyService((latitude, longitude, radius) -> {
            calls.incrementAndGet();
            return List.of();
        });

        assertInvalidQuery(() -> service.nearby(null, LONGITUDE, 500));
        assertInvalidQuery(() -> service.nearby(LATITUDE, null, 500));
        assertInvalidQuery(() -> service.nearby(new BigDecimal("90.1"), LONGITUDE, 500));
        assertInvalidQuery(() -> service.nearby(LATITUDE, new BigDecimal("-180.1"), 500));
        assertInvalidQuery(() -> service.nearby(LATITUDE, LONGITUDE, 700));
        assertThat(calls).hasValue(0);
    }

    private static void assertInvalidQuery(ThrowingCallable call) {
        assertThatThrownBy(call)
                .isInstanceOfSatisfying(InvalidInputException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.MAP_QUERY_INVALID));
    }

    private static Agency agency(String id, int distance) {
        return new Agency(id, "중개업소 " + id, "주소", new BigDecimal("37.4064"), new BigDecimal("127.0888"),
                distance, null, null);
    }
}
