package com.jachwisunbae.rental.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class RentalValueObjectsTest {
    @Test
    void areaEqualityIgnoresInputScaleWithoutLosingPrecision() {
        RentalArea area = new RentalArea(new BigDecimal("20"), AreaBasis.EXCLUSIVE);

        assertThat(area).isEqualTo(new RentalArea(new BigDecimal("20.00000"), AreaBasis.EXCLUSIVE));
        assertThat(area.areaM2()).hasScaleOf(4);
        assertThat(area).isNotEqualTo(new RentalArea(new BigDecimal("20"), AreaBasis.CONTRACT));
    }

    @Test
    void legalDongKeepsFullNameAndRejectsNamesThatCannotBeStored() {
        String fullName = "서울특별시 관악구 신림동";
        LegalDong legalDong = new LegalDong("1162010200", fullName);

        assertThat(legalDong).isEqualTo(new LegalDong("1162010200", fullName));
        assertThat(legalDong).isNotEqualTo(new LegalDong("1162010100", fullName));
        assertThat(new LegalDong("1162010200", "가".repeat(150)).name()).hasSize(150);
        assertThatThrownBy(() -> new LegalDong("1162010200", "가".repeat(151)))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new LegalDong("1162010200", " "))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"123", "abcdefghij", "11620102000"})
    void rejectsInvalidLegalDongCodes(final String code) {
        assertThatThrownBy(() -> new LegalDong(code, "서울특별시 관악구 신림동"))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void zeroDepositIsAllowedForPositiveMonthlyRent() {
        RentalPrice price = new RentalPrice(0, 1);

        assertThat(price.depositAmountKrw()).isZero();
        assertThat(price.monthlyRentAmountKrw()).isOne();
    }

    @Test
    void sourceIdentityIncludesExactFileNameAndRowNumber() {
        RentalSource source = new RentalSource("raw/source.csv", 1);

        assertThat(source).isEqualTo(new RentalSource("raw/source.csv", 1));
        assertThat(source).isNotEqualTo(new RentalSource("raw/other.csv", 1));
        assertThat(source).isNotEqualTo(new RentalSource("raw/source.csv", 2));
        assertThat(new RentalSource(" raw/source.csv ", 1).sourceFile()).isEqualTo(" raw/source.csv ");
        assertThat(new RentalSource("a".repeat(255), 1).sourceFile()).hasSize(255);
        assertThatThrownBy(() -> new RentalSource("a".repeat(256), 1)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new RentalSource(" ", 1)).isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @ValueSource(longs = {0, -1})
    void rejectsNonPositiveSourceRowNumbers(final long rowNumber) {
        assertThatThrownBy(() -> new RentalSource("raw/source.csv", rowNumber))
            .isInstanceOf(IllegalArgumentException.class);
    }
}
