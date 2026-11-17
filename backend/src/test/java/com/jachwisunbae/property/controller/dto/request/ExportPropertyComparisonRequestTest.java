package com.jachwisunbae.property.controller.dto.request;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ExportPropertyComparisonRequestTest {

    private static final Validator VALIDATOR = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    @DisplayName("매물 하나만 골라도 PDF 요청 검증을 통과한다")
    void acceptsSingleProperty() {
        // given
        ExportPropertyComparisonRequest request = new ExportPropertyComparisonRequest(List.of(10L));

        // when
        Set<ConstraintViolation<ExportPropertyComparisonRequest>> violations = VALIDATOR.validate(request);

        // then
        assertThat(violations).isEmpty();
    }

    @Test
    @DisplayName("매물을 하나도 고르지 않으면 요청 검증에 실패한다")
    void rejectsEmptySelection() {
        // given
        ExportPropertyComparisonRequest request = new ExportPropertyComparisonRequest(List.of());

        // when
        Set<ConstraintViolation<ExportPropertyComparisonRequest>> violations = VALIDATOR.validate(request);

        // then
        assertThat(violations)
                .extracting(violation -> violation.getPropertyPath().toString())
                .containsExactly("propertyIds");
    }

    @Test
    @DisplayName("매물을 5개보다 많이 고르면 요청 검증에 실패한다")
    void rejectsTooManyProperties() {
        // given
        ExportPropertyComparisonRequest request =
                new ExportPropertyComparisonRequest(List.of(1L, 2L, 3L, 4L, 5L, 6L));

        // when
        Set<ConstraintViolation<ExportPropertyComparisonRequest>> violations = VALIDATOR.validate(request);

        // then
        assertThat(violations)
                .extracting(violation -> violation.getPropertyPath().toString())
                .containsExactly("propertyIds");
    }
}
