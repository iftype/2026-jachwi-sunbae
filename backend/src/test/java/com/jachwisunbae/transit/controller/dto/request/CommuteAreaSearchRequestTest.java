package com.jachwisunbae.transit.controller.dto.request;

import static org.assertj.core.api.Assertions.assertThat;

import com.jachwisunbae.transit.domain.vo.Coordinate;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class CommuteAreaSearchRequestTest {

    private static final Validator VALIDATOR = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    @DisplayName("최대 통근 시간과 최대 환승 횟수를 비우면 기본값 60분, 2회를 쓴다")
    void usesDefaults() {
        CommuteAreaSearchRequest request = new CommuteAreaSearchRequest(37.5, 127.0, null, null);

        assertThat(request.maxMinutes()).isEqualTo(60);
        assertThat(request.maxTransfers()).isEqualTo(2);
        assertThat(request.destination()).isEqualTo(new Coordinate(37.5, 127.0));
    }

    @Test
    @DisplayName("요청한 최대 통근 시간과 최대 환승 횟수를 그대로 쓴다")
    void keepsRequestedValues() {
        CommuteAreaSearchRequest request = new CommuteAreaSearchRequest(37.5, 127.0, 40, 0);

        assertThat(request.maxMinutes()).isEqualTo(40);
        assertThat(request.maxTransfers()).isZero();
    }

    @Test
    @DisplayName("최대 통근 시간 60분, 최대 환승 횟수 2회까지 요청할 수 있다")
    void acceptsUpperLimit() {
        assertThat(VALIDATOR.validate(new CommuteAreaSearchRequest(37.5, 127.0, 60, 2))).isEmpty();
    }

    @ParameterizedTest
    @CsvSource({"61, 2, maxMinutes", "0, 2, maxMinutes", "60, 3, maxTransfers", "60, -1, maxTransfers"})
    @DisplayName("최대 통근 시간은 1~60분, 최대 환승 횟수는 0~2회를 벗어나면 요청할 수 없다")
    void rejectsOutOfRange(final int maxMinutes, final int maxTransfers, final String field) {
        Set<ConstraintViolation<CommuteAreaSearchRequest>> violations =
                VALIDATOR.validate(new CommuteAreaSearchRequest(37.5, 127.0, maxMinutes, maxTransfers));

        assertThat(violations).extracting(violation -> violation.getPropertyPath().toString()).containsExactly(field);
    }
}
